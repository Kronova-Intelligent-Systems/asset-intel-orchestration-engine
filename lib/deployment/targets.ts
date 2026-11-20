/**
 * Deployment target helpers shared by the v1 deployment routes and the
 * on_premise_ai_deployment skill.
 *
 * A target is a machine the customer runs a Kronova runner on. The runner proves
 * its identity with a token. Only the sha256 hash of the token is stored, so a
 * database leak does not expose working credentials.
 */

import { createHash, randomBytes } from "node:crypto"
import type { NextRequest } from "next/server"
import { createAdminSupabaseClient } from "@/lib/supabase/admin"

export const RUNNER_TOKEN_PREFIX = "kdt_"
export const TARGET_TYPES = ["private_cloud", "on_premise_server", "edge_device"] as const
export const SECURITY_PROFILES = ["standard", "high_security", "air_gapped"] as const
export type TargetType = (typeof TARGET_TYPES)[number]
export type SecurityProfile = (typeof SECURITY_PROFILES)[number]

/** A runner that has not polled for this long is treated as offline. */
export const RUNNER_ONLINE_WINDOW_MS = 5 * 60 * 1000
/** A claimed or running job with no report for this long is failed so it cannot block the queue. */
export const JOB_STALE_MS = 60 * 60 * 1000

export const PROFILE_RANK: Record<SecurityProfile, number> = { standard: 0, high_security: 1, air_gapped: 2 }

export function hashRunnerToken(token: string): string {
  return createHash("sha256").update(token).digest("hex")
}

export function generateRunnerToken(): { token: string; hash: string } {
  const token = `${RUNNER_TOKEN_PREFIX}${randomBytes(32).toString("base64url")}`
  return { token, hash: hashRunnerToken(token) }
}

/** Model ids are passed to a customer-side command, so keep them to a conservative character set. */
const MODEL_ID_RE = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,127}$/

export function isValidModelId(id: unknown): id is string {
  return typeof id === "string" && MODEL_ID_RE.test(id) && !id.includes("..")
}

export function runnerIsOnline(lastSeenAt: string | null | undefined): boolean {
  if (!lastSeenAt) return false
  const seen = new Date(lastSeenAt).getTime()
  return Number.isFinite(seen) && Date.now() - seen < RUNNER_ONLINE_WINDOW_MS
}

/** Columns that are safe to return to API callers. Never includes token_hash. */
export const TARGET_PUBLIC_COLUMNS =
  "id, name, target_type, security_profile, status, runner_version, capabilities, last_seen_at, created_at"

export interface RunnerAuth {
  ok: true
  target: { id: string; user_id: string; name: string; target_type: string; security_profile: string }
  supabase: ReturnType<typeof createAdminSupabaseClient>
}

export interface RunnerAuthFailure {
  ok: false
  status: number
  error: string
}

/**
 * Authenticates a runner by its bearer token. Runners are not users, so they use the
 * service-role client; every query made on their behalf must filter on target.id.
 */
export async function authenticateRunner(request: NextRequest): Promise<RunnerAuth | RunnerAuthFailure> {
  const header = request.headers.get("authorization")
  if (!header?.startsWith("Bearer ")) {
    return { ok: false, status: 401, error: "Runner token required" }
  }
  const token = header.slice(7).trim()
  if (!token.startsWith(RUNNER_TOKEN_PREFIX) || token.length > 200) {
    return { ok: false, status: 401, error: "Invalid runner token" }
  }

  const supabase = createAdminSupabaseClient()
  const { data, error } = await supabase
    .from("deployment_targets")
    .select("id, user_id, name, target_type, security_profile, status")
    .eq("token_hash", hashRunnerToken(token))
    .maybeSingle()

  if (error) {
    console.error("[deployment] runner auth lookup failed:", error.message)
    return { ok: false, status: 500, error: "Authentication failed" }
  }
  if (!data || data.status === "revoked") {
    return { ok: false, status: 401, error: "Invalid runner token" }
  }
  return { ok: true, target: data, supabase }
}
