/**
 * The last two skills: on_premise_ai_deployment and data_sovereignty_manager.
 *
 * on_premise_ai_deployment is "preview": it queues a real job in deployment_jobs for a
 * customer-side runner (scripts/kronova-runner.mjs). Kronova cannot reach into a
 * customer network, so the deployment only happens when a runner the customer operates
 * claims and executes the job. The output states this and reports whether a runner is online.
 *
 * data_sovereignty_manager is "live": it compares the user's recorded data_stores
 * inventory with the residency rules supplied. It reports findings. It never states that
 * a configuration is "compliant", because that is a legal conclusion.
 */

import { SkillError, type SkillContext, type SkillDefinition, type SkillOutput } from "./types"
import { dbError } from "./data-skills"
import {
  PROFILE_RANK,
  SECURITY_PROFILES,
  TARGET_TYPES,
  isValidModelId,
  runnerIsOnline,
  type SecurityProfile,
} from "@/lib/deployment/targets"

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const DAY_MS = 86_400_000
const MAX_QUEUED_PER_TARGET = 20
const MAX_MODELS = 10

// ---------------------------------------------------------------------------
// on_premise_ai_deployment
// ---------------------------------------------------------------------------

const NETWORK_POLICY: Record<SecurityProfile, { outbound: string; note: string }> = {
  standard: { outbound: "allowed", note: "The runner may pull model artifacts from the network." },
  high_security: {
    outbound: "allowlist",
    note: "The runner may only contact hosts the customer has allow-listed locally.",
  },
  air_gapped: {
    outbound: "none",
    note: "No network access. Model artifacts must already be staged on the target.",
  },
}

export const onPremiseAiDeployment: SkillDefinition = {
  id: "on_premise_ai_deployment",
  name: "On-premise AI deployment",
  description:
    "Queue an AI model deployment for a customer-side runner on a registered private cloud, on-premise server or edge device. Without confirm it returns the manifest that would be queued.",
  category: "Deployment and infrastructure",
  tags: ["on-premise", "deployment", "runner", "air-gapped"],
  status: "preview",
  mutates: true,
  inputSchema: {
    type: "object",
    required: ["deployment_target", "model_ids"],
    properties: {
      deployment_target: {
        type: "string",
        description: "Kind of target to deploy to",
        enum: [...TARGET_TYPES],
      },
      model_ids: {
        type: "array",
        description: `Models to deploy (1-${MAX_MODELS}). The runner resolves them locally.`,
        items: { type: "string" },
      },
      security_profile: {
        type: "string",
        description: "Security profile. Defaults to the target's own profile and may not be weaker than it.",
        enum: [...SECURITY_PROFILES],
      },
      target_id: {
        type: "string",
        description: "Registered target id. Required only when more than one target of this type exists.",
        maxLength: 36,
      },
    },
  },
  examples: ["Deploy model llama-3.1-8b to my on-premise server", "Queue an air-gapped edge deployment"],
  dataSources: ["deployment_targets", "deployment_jobs"],
  limitations:
    "Queues a job for a runner you operate (scripts/kronova-runner.mjs). The deployment happens only when that runner claims and runs the job; Kronova never connects into your network. Register a target first with POST /api/v1/deployment/targets.",
  async run(input, ctx: SkillContext): Promise<SkillOutput> {
    const models: string[] = [...new Set<string>(input.model_ids)]
    if (models.length === 0 || models.length > MAX_MODELS) {
      throw new SkillError("INVALID_INPUT", `model_ids must contain between 1 and ${MAX_MODELS} models`)
    }
    const badModel = models.find((id): boolean => !isValidModelId(id))
    if (badModel) {
      throw new SkillError("INVALID_INPUT", `Invalid model id "${badModel.slice(0, 40)}"`, {
        allowed: "letters, digits and . _ : / -, starting with a letter or digit, up to 128 characters",
      })
    }

    let query = ctx.supabase
      .from("deployment_targets")
      .select("id, name, target_type, security_profile, status, last_seen_at")
      .eq("user_id", ctx.userId)
      .neq("status", "revoked")
    if (input.target_id) {
      if (!UUID.test(input.target_id)) throw new SkillError("INVALID_INPUT", "target_id must be a UUID")
      query = query.eq("id", input.target_id)
    } else {
      query = query.eq("target_type", input.deployment_target)
    }
    const { data: targets, error: targetError } = await query.limit(10)
    if (targetError) throw dbError("Failed to look up deployment targets", targetError)

    const matching = (targets ?? []).filter((t: any) => t.target_type === input.deployment_target)
    if (matching.length === 0) {
      throw new SkillError(
        "NOT_FOUND",
        `No ${input.deployment_target} target is registered. Register one with POST /api/v1/deployment/targets, run the runner on that machine, then retry.`,
      )
    }
    if (matching.length > 1) {
      throw new SkillError("AMBIGUOUS", `${matching.length} targets match; pass target_id`, {
        candidates: matching.map((t: any) => ({ id: t.id, name: t.name })),
      })
    }
    const target = matching[0]

    const targetProfile = target.security_profile as SecurityProfile
    const profile: SecurityProfile = input.security_profile ?? targetProfile
    if (PROFILE_RANK[profile] < PROFILE_RANK[targetProfile]) {
      throw new SkillError(
        "INVALID_INPUT",
        `Target "${target.name}" is registered as ${targetProfile}; a deployment cannot use the weaker ${profile} profile`,
      )
    }

    const online = runnerIsOnline(target.last_seen_at)
    const warnings: string[] = []
    if (!online) {
      warnings.push(
        "No runner has contacted this target in the last 5 minutes. The job will wait in the queue until a runner starts.",
      )
    }
    if (profile === "air_gapped") {
      warnings.push("Air-gapped: model artifacts must already be staged on the target; the runner will not download them.")
    }

    const manifest = {
      version: 1,
      models,
      security_profile: profile,
      network_policy: NETWORK_POLICY[profile],
      target: { id: target.id, name: target.name, type: target.target_type },
    }

    const { count: queued, error: countError } = await ctx.supabase
      .from("deployment_jobs")
      .select("id", { count: "exact", head: true })
      .eq("user_id", ctx.userId)
      .eq("target_id", target.id)
      .eq("status", "queued")
    if (countError) throw dbError("Failed to read the deployment queue", countError)

    const base = {
      target: { id: target.id, name: target.name, status: target.status, runner_online: online },
      manifest,
      queue_depth: queued ?? 0,
    }
    const dataSources = ["deployment_targets", "deployment_jobs"]

    if (!ctx.confirm) {
      return {
        summary: `Dry run: would queue ${models.length} model(s) for "${target.name}" (${profile}). Re-run with confirm to queue the job.`,
        data: { ...base, job: null },
        dryRun: true,
        warnings,
        dataSources,
      }
    }

    if ((queued ?? 0) >= MAX_QUEUED_PER_TARGET) {
      throw new SkillError("UNSUPPORTED", `Target "${target.name}" already has ${MAX_QUEUED_PER_TARGET} queued jobs`)
    }

    const { data: job, error: insertError } = await ctx.supabase
      .from("deployment_jobs")
      .insert({ user_id: ctx.userId, target_id: target.id, model_ids: models, security_profile: profile, manifest })
      .select("id, status, created_at")
      .single()
    if (insertError) throw dbError("Failed to queue the deployment job", insertError)

    return {
      summary: `Queued deployment job ${job.id} for "${target.name}". It runs when the runner on that target claims it; check status at GET /api/v1/deployment/jobs.`,
      data: { ...base, queue_depth: (queued ?? 0) + 1, job },
      warnings,
      dataSources,
    }
  },
}

// ---------------------------------------------------------------------------
// data_sovereignty_manager
// ---------------------------------------------------------------------------

const EU = [
  "AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR", "DE", "GR", "HU", "IE",
  "IT", "LV", "LT", "LU", "MT", "NL", "PL", "PT", "RO", "SK", "SI", "ES", "SE",
]
const EEA = [...EU, "IS", "LI", "NO"]
const CLASSIFICATION_RANK: Record<string, number> = { public: 0, internal: 1, confidential: 2, restricted: 3 }
const STALE_VERIFICATION_DAYS = 180

/** Expands the EU and EEA group names; every other value must be a two-letter country code. */
function expandJurisdictions(values: string[]): Set<string> {
  const out = new Set<string>()
  for (const raw of values) {
    const value = raw.trim().toUpperCase()
    if (value === "EU") {
      for (const c of [...EU, "EU"]) out.add(c)
    } else if (value === "EEA") {
      for (const c of [...EEA, "EU", "EEA"]) out.add(c)
    } else if (/^[A-Z]{2}$/.test(value)) {
      out.add(value)
    } else {
      throw new SkillError("INVALID_INPUT", `Invalid jurisdiction "${raw.slice(0, 20)}"; use ISO country codes, EU or EEA`)
    }
  }
  return out
}

type Severity = "high" | "medium" | "low" | "info"
interface Finding {
  severity: Severity
  store: string
  rule: string
  detail: string
}

export const dataSovereigntyManager: SkillDefinition = {
  id: "data_sovereignty_manager",
  name: "Data sovereignty manager",
  description:
    "Compare your recorded data store inventory with residency rules. Returns findings per store; it does not certify compliance.",
  category: "Deployment and infrastructure",
  tags: ["sovereignty", "gdpr", "residency", "data-stores"],
  status: "live",
  mutates: false,
  inputSchema: {
    type: "object",
    required: ["data_classification", "jurisdictions"],
    properties: {
      data_classification: {
        type: "string",
        description: "Assess stores at this sensitivity level or higher",
        enum: ["public", "internal", "confidential", "restricted"],
      },
      jurisdictions: {
        type: "array",
        description: "Jurisdictions where this data may reside: ISO country codes, EU or EEA",
        items: { type: "string" },
      },
      compliance_frameworks: {
        type: "array",
        description: "Frameworks to apply. GDPR has automated checks; others are listed as not checked.",
        items: { type: "string" },
      },
    },
  },
  examples: ["Which of my confidential data stores sit outside the EU?", "Check restricted data against EEA residency with GDPR"],
  dataSources: ["data_stores"],
  limitations:
    "Only as accurate as the inventory in data_stores (POST /api/v1/data-stores). Reports findings, not legal conclusions. Only GDPR has automated checks.",
  async run(input, ctx: SkillContext): Promise<SkillOutput> {
    const jurisdictionInput: string[] = input.jurisdictions
    if (jurisdictionInput.length === 0) throw new SkillError("INVALID_INPUT", "jurisdictions must not be empty")
    const allowed = expandJurisdictions(jurisdictionInput)
    const frameworks = [...new Set<string>((input.compliance_frameworks ?? []).map((f: string) => f.trim().toUpperCase()))]
    const minRank = CLASSIFICATION_RANK[input.data_classification]

    const { data, error } = await ctx.supabase
      .from("data_stores")
      .select("id, name, store_type, provider, region, jurisdiction, data_classification, contains_personal_data, transfer_mechanism, last_verified_at")
      .eq("user_id", ctx.userId)
      .limit(500)
    if (error) throw dbError("Failed to read the data store inventory", error)

    const all = data ?? []
    const inScope = all.filter((s: any) => CLASSIFICATION_RANK[s.data_classification] >= minRank)
    const warnings: string[] = []
    const findings: Finding[] = []

    const known = new Set(["GDPR"])
    for (const framework of frameworks) {
      if (!known.has(framework)) {
        warnings.push(`No automated checks exist for ${framework}; it was not evaluated.`)
      }
    }
    const gdpr = frameworks.includes("GDPR")

    for (const store of inScope) {
      const where = store.jurisdiction as string
      const rank = CLASSIFICATION_RANK[store.data_classification]
      if (!allowed.has(where)) {
        findings.push({
          severity: rank >= 2 ? "high" : rank === 1 ? "medium" : "low",
          store: store.name,
          rule: "residency",
          detail: `${store.data_classification} data is stored in ${where}, which is not in the allowed jurisdictions (${jurisdictionInput.join(", ")}).`,
        })
      }
      if (gdpr && store.contains_personal_data && !EEA.includes(where) && where !== "EU" && where !== "EEA") {
        const mechanism = store.transfer_mechanism
        if (!mechanism || mechanism === "none") {
          findings.push({
            severity: "high",
            store: store.name,
            rule: "gdpr_transfer",
            detail: `Personal data is held in ${where}, outside the EEA, and no transfer mechanism is recorded.`,
          })
        } else {
          findings.push({
            severity: "info",
            store: store.name,
            rule: "gdpr_transfer",
            detail: `Personal data is held in ${where} under a recorded "${mechanism}" transfer mechanism. Kronova does not verify that the mechanism is valid.`,
          })
        }
      }
      const age = Math.floor((Date.now() - new Date(store.last_verified_at).getTime()) / DAY_MS)
      if (Number.isFinite(age) && age > STALE_VERIFICATION_DAYS) {
        findings.push({
          severity: "low",
          store: store.name,
          rule: "stale_inventory",
          detail: `This record was last verified ${age} days ago.`,
        })
      }
    }

    const counts = { high: 0, medium: 0, low: 0, info: 0 }
    for (const f of findings) counts[f.severity] += 1
    const actionable = counts.high + counts.medium + counts.low

    let result: "inventory_empty" | "no_findings" | "findings"
    let summary: string
    if (all.length === 0) {
      result = "inventory_empty"
      summary = "No data stores are recorded, so nothing could be assessed. Add stores with POST /api/v1/data-stores."
      warnings.push("An empty inventory is not evidence that no data is held in restricted locations.")
    } else if (inScope.length === 0) {
      result = "no_findings"
      summary = `No recorded stores are classified ${input.data_classification} or higher (${all.length} stores recorded).`
    } else if (actionable === 0) {
      result = "no_findings"
      summary = `Assessed ${inScope.length} store(s); no findings against the supplied rules. This reflects the recorded inventory only.`
    } else {
      result = "findings"
      summary = `Assessed ${inScope.length} store(s): ${counts.high} high, ${counts.medium} medium, ${counts.low} low finding(s).`
    }

    const order: Severity[] = ["high", "medium", "low", "info"]
    findings.sort((a, b) => order.indexOf(a.severity) - order.indexOf(b.severity))

    warnings.push("This is a comparison of your recorded inventory with the rules you supplied. It is not legal advice and does not certify compliance.")

    return {
      summary,
      data: {
        result,
        stores_recorded: all.length,
        stores_assessed: inScope.length,
        allowed_jurisdictions: [...allowed].sort(),
        frameworks_evaluated: frameworks.filter((f) => known.has(f)),
        frameworks_not_evaluated: frameworks.filter((f) => !known.has(f)),
        finding_counts: counts,
        findings,
      },
      warnings,
      dataSources: ["data_stores"],
    }
  },
}

export const deploymentSkills: SkillDefinition[] = [onPremiseAiDeployment, dataSovereigntyManager]
