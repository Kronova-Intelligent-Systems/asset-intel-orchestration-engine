/**
 * Runner protocol: report job progress.
 *
 * POST { status: "running" | "succeeded" | "failed", result?, error? } with the runner token.
 * A runner can only touch jobs of its own target, and only move them forward.
 */

import type { NextRequest } from "next/server"
import { apiError, apiSuccess } from "@/lib/auth/api-auth"
import { authenticateRunner } from "@/lib/deployment/targets"

export const dynamic = "force-dynamic"

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const ALLOWED: Record<string, string[]> = {
  claimed: ["running", "succeeded", "failed"],
  running: ["succeeded", "failed"],
}
const MAX_RESULT_CHARS = 64_000

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const runner = await authenticateRunner(request)
    if (!runner.ok) return apiError(runner.error, runner.status)
    const { supabase, target } = runner

    const { id } = await params
    if (!UUID.test(id)) return apiError("Invalid job id", 400)

    let body: any
    try {
      body = await request.json()
    } catch {
      return apiError("Request body must be JSON", 400)
    }
    const status = body?.status
    if (!["running", "succeeded", "failed"].includes(status)) {
      return apiError("status must be running, succeeded or failed", 400)
    }

    let result: unknown = null
    if (body?.result !== undefined && body.result !== null) {
      if (typeof body.result !== "object" || Array.isArray(body.result)) return apiError("result must be an object", 400)
      if (JSON.stringify(body.result).length > MAX_RESULT_CHARS) return apiError("result is too large", 413)
      result = body.result
    }
    const errorText = typeof body?.error === "string" ? body.error.slice(0, 2000) : null

    const { data: job, error: readError } = await supabase
      .from("deployment_jobs")
      .select("id, status")
      .eq("id", id)
      .eq("target_id", target.id)
      .maybeSingle()
    if (readError) return apiError("Failed to read job", 500)
    if (!job) return apiError("Job not found", 404)
    if (!ALLOWED[job.status]?.includes(status)) {
      return apiError(`Job is ${job.status}; it cannot move to ${status}`, 409)
    }

    const finished = status === "succeeded" || status === "failed"
    const { data: updated, error: updateError } = await supabase
      .from("deployment_jobs")
      .update({
        status,
        ...(result !== null && { result }),
        ...(status === "failed" && { error: errorText ?? "Runner reported failure" }),
        ...(finished && { finished_at: new Date().toISOString() }),
      })
      .eq("id", id)
      .eq("target_id", target.id)
      .eq("status", job.status)
      .select("id, status")
      .maybeSingle()
    if (updateError) return apiError("Failed to update job", 500)
    if (!updated) return apiError("Job changed while updating; retry", 409)

    return apiSuccess({ job: updated })
  } catch (error) {
    console.error("[Deployment Runner] report error:", error)
    return apiError("Internal server error", 500)
  }
}
