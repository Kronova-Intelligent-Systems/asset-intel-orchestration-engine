import { AIClient } from "@/lib/ai/ai-client"
import { MANAGED_PROVIDERS, MODEL_MANIFEST } from "@/lib/ai/model-catalog"
import { opsDb } from "./db"
import { isChatCandidate, isRecent, listProviderModels } from "./discovery"
import { actionId } from "./governance"
import { CRON_JOB_NAME, CRON_SCHEDULE, buildCommand, cronPrerequisites, getCronJob } from "./pg-cron"
import type { ManagedProvider, Plan, PlanAction, Risk } from "./types"

const PROBE_BUDGET = 12
const NEW_MODEL_CAP = 6

interface ProbeResult {
  ok: boolean
  parameters?: Record<string, number>
}

async function probeModel(provider: ManagedProvider, model: string): Promise<ProbeResult> {
  const apiKey = provider === "openai" ? process.env.OPENAI_API_KEY : process.env.ANTHROPIC_API_KEY
  if (!apiKey) return { ok: false }
  const client = new AIClient(provider, apiKey, model)
  const messages = [{ role: "user" as const, content: "Reply with the single word OK." }]
  try {
    await client.createChatCompletion({ model, messages, max_tokens: 16, temperature: 0.7 })
    return { ok: true, parameters: { max_tokens: 8192, temperature: 0.7 } }
  } catch {
    // Frontier models reject custom sampling, so retry without it.
  }
  try {
    await client.createChatCompletion({ model, messages, max_tokens: 16 })
    return { ok: true, parameters: { max_tokens: 16384 } }
  } catch {
    return { ok: false }
  }
}

function makeAction(kind: PlanAction["kind"], risk: Risk, summary: string, params: Record<string, unknown>): PlanAction {
  return { id: actionId(kind, params), kind, risk, summary, params }
}

function humanize(id: string): string {
  return id
    .split("-")
    .map((part) => (part.length <= 3 && /^[a-z]\d?$/i.test(part) ? part.toUpperCase() : part.charAt(0).toUpperCase() + part.slice(1)))
    .join(" ")
}

export async function buildPlan(trigger: "cron" | "api"): Promise<Plan> {
  const notes: string[] = []
  const actions: PlanAction[] = []
  const { byProvider, listings } = await listProviderModels()

  const { data: rows, error } = await opsDb()
    .from("ai_models")
    .select("id, provider, model_id, is_active, type")
    .in("provider", [...MANAGED_PROVIDERS])
  if (error) throw new Error(`Could not read ai_models: ${error.message}`)

  const known = new Set((rows ?? []).map((r) => `${r.provider}:${r.model_id}`))
  const manifestIds = new Set(MODEL_MANIFEST.map((m) => m.model_id))
  const live: string[] = []
  const registrations: Array<Record<string, unknown>> = []
  const retirements: Array<{ provider: ManagedProvider; model_id: string }> = []
  let probes = 0

  for (const listing of listings) {
    const provider = listing.provider
    if (!listing.ok) {
      notes.push(`${provider}: listing failed (${listing.error ?? "empty"}); discovery and retirement skipped for this provider`)
      continue
    }
    const listed = byProvider[provider]
    const listedIds = new Set(listed.map((m) => m.id))

    for (const row of (rows ?? []).filter((r) => r.provider === provider)) {
      // A chat probe cannot judge image, embedding or speech models, so those rows are never touched.
      if (row.type !== "chat" || !isChatCandidate(provider, row.model_id)) {
        if (row.is_active) notes.push(`${row.model_id} is not a chat model; left unchanged`)
        continue
      }
      if (listedIds.has(row.model_id)) {
        if (row.is_active || manifestIds.has(row.model_id)) live.push(row.model_id)
        continue
      }
      if (!row.is_active) continue
      if (probes >= PROBE_BUDGET) {
        notes.push(`Probe budget reached; ${row.model_id} was not checked`)
        continue
      }
      probes += 1
      const probe = await probeModel(provider, row.model_id)
      if (probe.ok) live.push(row.model_id)
      else retirements.push({ provider, model_id: row.model_id })
    }

    const fresh = listed
      .filter((m) => !known.has(`${provider}:${m.id}`) && isChatCandidate(provider, m.id) && isRecent(m))
      .sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0))
    if (fresh.length > NEW_MODEL_CAP) notes.push(`${provider}: ${fresh.length - NEW_MODEL_CAP} more new models deferred to the next run`)

    for (const model of fresh.slice(0, NEW_MODEL_CAP)) {
      if (probes >= PROBE_BUDGET) {
        notes.push(`Probe budget reached; ${model.id} was not checked`)
        break
      }
      probes += 1
      const probe = await probeModel(provider, model.id)
      if (!probe.ok) {
        notes.push(`${model.id} is listed but failed a live call, so it was not registered`)
        continue
      }
      const name = model.displayName ?? humanize(model.id)
      const params = { provider, model_id: model.id, name, description: `${provider === "openai" ? "OpenAI" : "Anthropic"} ${name}`, parameters: probe.parameters }
      registrations.push(params)
      actions.push(makeAction("register_model", "medium", `Register ${model.id} (${provider})`, params))
    }
  }

  for (const retired of retirements) {
    actions.push(makeAction("deactivate_model", "medium", `Retire ${retired.model_id}: absent from the provider list and failed a live call`, retired))
  }

  if (live.length > 0) {
    const ids = [...new Set(live)].sort()
    actions.push(makeAction("refresh_listed", "low", `Re-stamp ${ids.length} models the provider still serves`, { model_ids: ids }))
  }

  const pre = cronPrerequisites()
  if (!pre.ok || !pre.siteUrl) {
    notes.push(`pg_cron job not managed: ${pre.reason}`)
  } else {
    try {
      const current = await getCronJob(CRON_JOB_NAME)
      const drifted = !current || !current.active || current.schedule !== CRON_SCHEDULE || current.command.trim() !== buildCommand(pre.siteUrl)
      if (drifted) {
        const verb = current ? "Repair" : "Create"
        actions.push(makeAction("ensure_cron_job", "low", `${verb} pg_cron job ${CRON_JOB_NAME} (${CRON_SCHEDULE})`, { jobName: CRON_JOB_NAME, schedule: CRON_SCHEDULE }))
      }
    } catch (err) {
      notes.push(`Could not read pg_cron: ${err instanceof Error ? err.message : "unknown error"}`)
    }
  }

  if (registrations.length > 0 || retirements.length > 0) {
    actions.push(
      makeAction("propose_catalog_change", "high", `Open a pull request updating lib/ai/model-catalog.ts (+${registrations.length} / -${retirements.length})`, {
        register: registrations,
        retire: retirements,
      }),
    )
  }

  return { version: 1, generatedAt: new Date().toISOString(), trigger, listings, notes, actions }
}
