/**
 * GET lists the caller's deployment jobs, newest first. Requires read:agents.
 * Query: status, target_id, limit (max 100).
 */

import type { NextRequest } from "next/server"
import { createAdminSupabaseClient } from "@/lib/supabase/admin"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { validateAPIAuth, apiError, apiSuccess } from "@/lib/auth/api-auth"

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const STATUSES = ["queued", "claimed", "running", "succeeded", "failed", "cancelled"]

export async function GET(request: NextRequest) {
  try {
    const auth = await validateAPIAuth(request, ["read:agents"])
    if (!auth.authenticated) return apiError(auth.error || "Authentication failed", auth.status || 401)

    const { searchParams } = new URL(request.url)
    const status = searchParams.get("status")
    const targetId = searchParams.get("target_id")
    const limit = Math.min(Math.max(Number.parseInt(searchParams.get("limit") || "50", 10) || 50, 1), 100)

    if (status && !STATUSES.includes(status)) return apiError(`status must be one of: ${STATUSES.join(", ")}`, 400)
    if (targetId && !UUID.test(targetId)) return apiError("Invalid target_id", 400)

    const supabase = auth.authMethod === "api_key" ? createAdminSupabaseClient() : await createServerSupabaseClient()
    let query = supabase
      .from("deployment_jobs")
      .select("id, target_id, model_ids, security_profile, status, manifest, result, error, claimed_at, finished_at, created_at")
      .eq("user_id", auth.userId!)
      .order("created_at", { ascending: false })
      .limit(limit)
    if (status) query = query.eq("status", status)
    if (targetId) query = query.eq("target_id", targetId)

    const { data, error } = await query
    if (error) return apiError("Failed to fetch deployment jobs", 500)
    return apiSuccess({ jobs: data ?? [] })
  } catch (error) {
    console.error("[Deployment Jobs API] error:", error)
    return apiError("Internal server error", 500)
  }
}
