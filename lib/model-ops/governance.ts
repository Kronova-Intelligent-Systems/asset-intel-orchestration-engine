import { createHash } from "node:crypto"
import { MANAGED_PROVIDERS } from "@/lib/ai/model-catalog"
import { verifyDetached } from "@/lib/pqc/crypto"
import { canonicalJson, parsePqcSignature, signingBytes, type PqcSignature } from "@/lib/pqc/envelope"
import { attest, getPlatformKeyInfo } from "@/lib/pqc/service"
import { opsDb } from "./db"
import { CRON_JOB_NAME, CRON_SCHEDULE_PATTERN } from "./pg-cron"
import type { ActionDecision, Plan, PlanAction, PolicyDecision, Verdict } from "./types"

const DOMAIN = "model-ops.plan" as const
const MAX_ACTIONS = 25
const MAX_DEACTIVATIONS = 5
const SIGNATURE_TTL_MS = 24 * 60 * 60 * 1000
const MODEL_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{1,99}$/

const managed = new Set<string>(MANAGED_PROVIDERS)

export function planHash(plan: Plan): string {
  return createHash("sha256").update(canonicalJson(plan)).digest("hex")
}

export function actionId(kind: string, params: Record<string, unknown>): string {
  return createHash("sha256").update(canonicalJson({ kind, params })).digest("hex").slice(0, 12)
}

export function signPlan(hash: string): Promise<PqcSignature | null> {
  return attest(DOMAIN, { planHash: hash })
}

export async function verifyPlanSignature(hash: string, raw: unknown): Promise<{ ok: boolean; reason: string }> {
  const signature = parsePqcSignature(raw)
  if (!signature) return { ok: false, reason: "Plan has no valid post-quantum signature" }
  const platform = getPlatformKeyInfo()
  if (!platform) return { ok: false, reason: "Platform signing key is not configured" }
  if (platform.keyId !== signature.keyId) return { ok: false, reason: "Plan was signed by an unknown key" }
  const age = Date.now() - Date.parse(signature.signedAt)
  if (age > SIGNATURE_TTL_MS || age < -5 * 60 * 1000) return { ok: false, reason: "Plan signature has expired" }
  const valid = await verifyDetached(
    signature.signature,
    signingBytes(DOMAIN, signature.keyId, signature.signedAt, { planHash: hash }),
    platform.publicKey,
  )
  return valid ? { ok: true, reason: "ML-DSA-65 signature verified" } : { ok: false, reason: "Plan signature does not match its contents" }
}

async function modelsInUse(): Promise<Set<string>> {
  const db = opsDb()
  const [{ data: agents }, { data: models }] = await Promise.all([
    db.from("ai_agents").select("model_id").not("model_id", "is", null),
    db.from("ai_models").select("id, provider, model_id"),
  ])
  const used = new Set((agents ?? []).map((a) => String(a.model_id)))
  const inUse = new Set<string>()
  for (const m of models ?? []) if (used.has(String(m.id))) inUse.add(`${m.provider}:${m.model_id}`)
  return inUse
}

function decide(action: PlanAction, inUse: Set<string>, deactivations: { count: number }): ActionDecision {
  const block = (reason: string): ActionDecision => ({ actionId: action.id, verdict: "blocked", reasons: [reason] })
  const p = action.params
  const verdict = (v: Verdict, reason: string): ActionDecision => ({ actionId: action.id, verdict: v, reasons: [reason] })

  switch (action.kind) {
    case "register_model": {
      if (!managed.has(String(p.provider))) return block("Provider is not managed by model ops")
      if (!MODEL_ID_PATTERN.test(String(p.model_id))) return block("Model id has an unexpected format")
      const params = (p.parameters ?? {}) as Record<string, unknown>
      const maxTokens = Number(params.max_tokens ?? 0)
      const temperature = params.temperature === undefined ? 0 : Number(params.temperature)
      if (!(maxTokens > 0 && maxTokens <= 65536) || !(temperature >= 0 && temperature <= 2)) return block("Parameters are out of bounds")
      return verdict("approval", "New catalog entries are user-visible and need approval")
    }
    case "deactivate_model": {
      if (!managed.has(String(p.provider))) return block("Provider is not managed by model ops")
      if (inUse.has(`${p.provider}:${p.model_id}`)) return block("Model is assigned to an agent")
      deactivations.count += 1
      if (deactivations.count > MAX_DEACTIVATIONS) return block(`More than ${MAX_DEACTIVATIONS} retirements in one run`)
      return verdict("approval", "Retiring a model needs approval")
    }
    case "refresh_listed": {
      const ids = p.model_ids
      if (!Array.isArray(ids) || !ids.every((id) => typeof id === "string" && MODEL_ID_PATTERN.test(id))) return block("Model id list is malformed")
      return verdict("auto", "Only re-stamps models the provider still serves")
    }
    case "ensure_cron_job": {
      if (p.jobName !== CRON_JOB_NAME) return block("Only the model-ops job may be managed")
      if (!CRON_SCHEDULE_PATTERN.test(String(p.schedule))) return block("Schedule is not a valid cron expression")
      return verdict("auto", "Restricted to the model-ops job; the command is rebuilt server-side")
    }
    case "propose_catalog_change":
      return verdict("approval", "Code changes land as a pull request after approval")
    default:
      return block("Unknown action kind")
  }
}

export async function evaluatePlan(plan: Plan): Promise<PolicyDecision> {
  const planViolations: string[] = []
  if (plan.actions.length > MAX_ACTIONS) planViolations.push(`Plan has more than ${MAX_ACTIONS} actions`)
  const inUse = await modelsInUse()
  const deactivations = { count: 0 }
  const decisions = plan.actions.map((action) =>
    planViolations.length
      ? ({ actionId: action.id, verdict: "blocked", reasons: planViolations } satisfies ActionDecision)
      : decide(action, inUse, deactivations),
  )
  return { decisions, planViolations }
}
