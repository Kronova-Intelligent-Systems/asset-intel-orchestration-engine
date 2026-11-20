/**
 * Runner protocol: heartbeat and claim.
 *
 * POST with `Authorization: Bearer kdt_...`. Records a heartbeat, fails jobs the runner
 * abandoned, and atomically claims the oldest queued job (or returns job: null).
 */

import type { NextRequest } from "next/server"
import { apiError, apiSuccess } from "@/lib/auth/api-auth"
import { JOB_STALE_MS, authenticateRunner } from "@/lib/deployment/targets"

export const dynamic = "force-dynamic"

export async function POST(request: NextRequest) {
  try {
    const runner = await authenticateRunner(request)
    if (!runner.ok) return apiError(runner.error, runner.status)
    const { supabase, target } = runner

    let body: any = {}
    try {
      body = await request.json()
    } catch {
      body = {}
    }
    const runnerVersion = typeof body?.runner_version === "string" ? body.runner_version.slice(0, 40) : undefined
    const capabilities =
      body?.capabilities && typeof body.capabilities === "object" && !Array.isArray(body.capabilities) && JSON.stringify(body.capabilities).length <= 4000
        ? body.capabilities
        : undefined

    await supabase
      .from("deployment_targets")
      .update({
        status: "online",
        last_seen_at: new Date().toISOString(),
        ...(runnerVersion && { runner_version: runnerVersion }),
        ...(capabilities && { capabilities }),
      })
      .eq("id", target.id)

    const staleBefore = new Date(Date.now() - JOB_STALE_MS).toISOString()
    await supabase
      .from("deployment_jobs")
      .update({ status: "failed", finished_at: new Date().toISOString(), error: "Runner did not report back in time" })
      .eq("target_id", target.id)
      .in("status", ["claimed", "running"])
      .lt("claimed_at", staleBefore)

    const { data: next, error: nextError } = await supabase
      .from("deployment_jobs")
      .select("id")
      .eq("target_id", target.id)
      .eq("status", "queued")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle()
    if (nextError) return apiError("Failed to read the job queue", 500)
    if (!next) return apiSuccess({ job: null })

    // The status guard makes the claim atomic: if another poll won the race, no row returns.
    const { data: claimed, error: claimError } = await supabase
      .from("deployment_jobs")
      .update({ status: "claimed", claimed_at: new Date().toISOString() })
      .eq("id", next.id)
      .eq("status", "queued")
      .select("id, model_ids, security_profile, manifest")
      .maybeSingle()
    if (claimError) return apiError("Failed to claim job", 500)

    return apiSuccess({ job: claimed ?? null })
  } catch (error) {
    console.error("[Deployment Runner] poll error:", error)
    return apiError("Internal server error", 500)
  }
}
