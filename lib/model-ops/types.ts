import type { PqcSignature } from "@/lib/pqc/envelope"

export type ManagedProvider = "openai" | "anthropic"

export type ActionKind =
  | "register_model"
  | "refresh_listed"
  | "deactivate_model"
  | "ensure_cron_job"
  | "propose_catalog_change"

export type Risk = "low" | "medium" | "high"

export interface PlanAction {
  id: string
  kind: ActionKind
  risk: Risk
  summary: string
  params: Record<string, unknown>
}

export interface ProviderListing {
  provider: ManagedProvider
  listed: number
  ok: boolean
  error?: string
}

export interface Plan {
  version: 1
  generatedAt: string
  trigger: "cron" | "api"
  listings: ProviderListing[]
  notes: string[]
  actions: PlanAction[]
}

export type Verdict = "auto" | "approval" | "blocked"

export interface ActionDecision {
  actionId: string
  verdict: Verdict
  reasons: string[]
}

export interface PolicyDecision {
  decisions: ActionDecision[]
  planViolations: string[]
}

export type ResultStatus = "applied" | "skipped" | "failed" | "blocked" | "stored"

export interface ActionResult {
  actionId: string
  status: ResultStatus
  detail: string
  at: string
}

export type RunStatus = "planned" | "applied" | "partially_applied" | "awaiting_approval" | "rejected" | "failed"

export interface RunRecord {
  id: string
  trigger: "cron" | "api"
  status: RunStatus
  requested_by: string | null
  plan: Plan
  plan_hash: string
  signature: PqcSignature | null
  policy: PolicyDecision
  results: ActionResult[]
  created_at: string
  updated_at: string
}
