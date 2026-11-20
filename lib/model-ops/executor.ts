import { MANAGED_PROVIDERS, MODEL_CAPABILITIES } from "@/lib/ai/model-catalog"
import { proposeCatalogChange } from "./code-proposal"
import { opsDb } from "./db"
import { evaluatePlan, planHash, signPlan, verifyPlanSignature } from "./governance"
import { buildPlan } from "./planner"
import { ensureCronJob } from "./pg-cron"
import type { ActionResult, PlanAction, RunRecord, RunStatus } from "./types"

const TERMINAL = new Set(["applied", "skipped", "stored", "blocked"])

export async function createRun(trigger: "cron" | "api", requestedBy: string | null): Promise<RunRecord> {
  const plan = await buildPlan(trigger)
  const hash = planHash(plan)
  const signature = await signPlan(hash)
  const policy = await evaluatePlan(plan)
  const { data, error } = await opsDb()
    .from("model_ops_runs")
    .insert({ trigger, status: "planned", requested_by: requestedBy, plan, plan_hash: hash, signature, policy })
    .select("*")
    .single()
  if (error || !data) throw new Error(`Could not record run: ${error?.message ?? "no row returned"}`)
  return data as RunRecord
}

export async function loadRun(runId: string): Promise<RunRecord | null> {
  const { data } = await opsDb().from("model_ops_runs").select("*").eq("id", runId).maybeSingle()
  return (data as RunRecord | null) ?? null
}

async function execute(action: PlanAction, run: RunRecord): Promise<{ status: ActionResult["status"]; detail: string }> {
  const db = opsDb()
  const p = action.params
  const now = new Date().toISOString()

  switch (action.kind) {
    case "register_model": {
      const { data: existing } = await db.from("ai_models").select("id").eq("provider", p.provider).eq("model_id", p.model_id).maybeSingle()
      if (existing) return { status: "skipped", detail: "Already registered" }
      const { error } = await db.from("ai_models").insert({
        provider: p.provider,
        model_id: p.model_id,
        name: p.name,
        description: p.description,
        capabilities: MODEL_CAPABILITIES,
        parameters: p.parameters,
        is_active: true,
        type: "chat",
        model_type: "chat",
      })
      return error ? { status: "failed", detail: error.message } : { status: "applied", detail: `Registered ${p.model_id}` }
    }
    case "refresh_listed": {
      const { data, error } = await db
        .from("ai_models")
        .update({ is_active: true, updated_at: now })
        .in("model_id", p.model_ids as string[])
        .in("provider", [...MANAGED_PROVIDERS])
        .select("id")
      return error ? { status: "failed", detail: error.message } : { status: "applied", detail: `Re-stamped ${data?.length ?? 0} rows` }
    }
    case "deactivate_model": {
      const { error } = await db.from("ai_models").update({ is_active: false, updated_at: now }).eq("provider", p.provider).eq("model_id", p.model_id)
      return error ? { status: "failed", detail: error.message } : { status: "applied", detail: `Deactivated ${p.model_id}` }
    }
    case "ensure_cron_job":
      return { status: "applied", detail: await ensureCronJob(String(p.schedule)) }
    case "propose_catalog_change": {
      const result = await proposeCatalogChange(p as never, {
        runId: run.id,
        planHash: run.plan_hash,
        signerKeyId: run.signature?.keyId ?? "unknown",
      })
      return result
    }
    default:
      return { status: "blocked", detail: "Unknown action kind" }
  }
}

export async function applyRun(
  runId: string,
  options: { mode: "auto" } | { mode: "approved"; actionIds: string[] },
): Promise<{ run: RunRecord; refused?: string }> {
  const run = await loadRun(runId)
  if (!run) throw new Error("Run not found")

  const fail = async (reason: string) => ({ run, refused: reason })
  if (planHash(run.plan) !== run.plan_hash) return fail("Stored plan does not match its hash; it may have been modified")
  const verification = await verifyPlanSignature(run.plan_hash, run.signature)
  if (!verification.ok) return fail(verification.reason)

  const policy = await evaluatePlan(run.plan)
  const done = new Map(run.results.filter((r) => TERMINAL.has(r.status)).map((r) => [r.actionId, r]))
  const results = new Map(run.results.map((r) => [r.actionId, r]))
  const wanted = options.mode === "approved" ? new Set(options.actionIds) : null

  for (const action of run.plan.actions) {
    if (done.has(action.id)) continue
    const decision = policy.decisions.find((d) => d.actionId === action.id)
    const at = new Date().toISOString()
    if (!decision || decision.verdict === "blocked") {
      results.set(action.id, { actionId: action.id, status: "blocked", detail: decision?.reasons.join("; ") ?? "No policy decision", at })
      continue
    }
    const allowed = options.mode === "auto" ? decision.verdict === "auto" : wanted!.has(action.id)
    if (!allowed) continue
    try {
      const outcome = await execute(action, run)
      results.set(action.id, { actionId: action.id, ...outcome, at: new Date().toISOString() })
    } catch (error) {
      results.set(action.id, { actionId: action.id, status: "failed", detail: error instanceof Error ? error.message : "Execution failed", at: new Date().toISOString() })
    }
  }

  const all = [...results.values()]
  const pending = run.plan.actions.filter((a) => !results.has(a.id) || results.get(a.id)!.status === "failed")
  const anyFailed = all.some((r) => r.status === "failed")
  const status: RunStatus = anyFailed ? "partially_applied" : pending.length > 0 ? "awaiting_approval" : "applied"

  const { data, error } = await opsDb()
    .from("model_ops_runs")
    .update({ results: all, status, policy, updated_at: new Date().toISOString() })
    .eq("id", run.id)
    .select("*")
    .single()
  if (error || !data) throw new Error(`Could not save run: ${error?.message}`)
  return { run: data as RunRecord }
}
