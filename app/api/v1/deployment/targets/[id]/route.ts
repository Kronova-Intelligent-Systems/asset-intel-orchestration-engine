/**
 * DELETE revokes a deployment target: its runner token stops working and its queued
 * jobs are cancelled. The row is kept so job history stays readable. Requires write:agents.
 */

import type { NextRequest } from "next/server"
import { createAdminSupabaseClient } from "@/lib/supabase/admin"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { validateAPIAuth, apiError, apiSuccess } from "@/lib/auth/api-auth"

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await validateAPIAuth(request, ["write:agents"])
    if (!auth.authenticated) return apiError(auth.error || "Authentication failed", auth.status || 401)

    const { id } = await params
    if (!UUID.test(id)) return apiError("Invalid target id", 400)

    const supabase = auth.authMethod === "api_key" ? createAdminSupabaseClient() : await createServerSupabaseClient()

    const { data, error } = await supabase
      .from("deployment_targets")
      .update({ status: "revoked" })
      .eq("id", id)
      .eq("user_id", auth.userId!)
      .select("id, name, status")
      .maybeSingle()

    if (error) return apiError("Failed to revoke target", 500)
    if (!data) return apiError("Deployment target not found", 404)

    await supabase
      .from("deployment_jobs")
      .update({ status: "cancelled", finished_at: new Date().toISOString(), error: "Target revoked" })
      .eq("target_id", id)
      .eq("user_id", auth.userId!)
      .in("status", ["queued", "claimed", "running"])

    return apiSuccess({ target: data })
  } catch (error) {
    console.error("[Deployment Targets API] DELETE error:", error)
    return apiError("Internal server error", 500)
  }
}
