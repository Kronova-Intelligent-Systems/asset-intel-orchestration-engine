/**
 * Kronova v1 Deployment Targets API
 *
 * GET  lists the caller's targets (requires read:agents)
 * POST registers a target and returns its runner token once (requires write:agents)
 */

import type { NextRequest } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { createAdminSupabaseClient } from "@/lib/supabase/admin"
import { validateAPIAuth, apiError, apiSuccess } from "@/lib/auth/api-auth"
import {
  SECURITY_PROFILES,
  TARGET_PUBLIC_COLUMNS,
  TARGET_TYPES,
  generateRunnerToken,
  runnerIsOnline,
} from "@/lib/deployment/targets"

const MAX_TARGETS_PER_USER = 50

async function clientFor(authMethod: "session" | "api_key") {
  return authMethod === "api_key" ? createAdminSupabaseClient() : await createServerSupabaseClient()
}

export async function GET(request: NextRequest) {
  try {
    const auth = await validateAPIAuth(request, ["read:agents"])
    if (!auth.authenticated) return apiError(auth.error || "Authentication failed", auth.status || 401)

    const supabase = await clientFor(auth.authMethod)
    const { data, error } = await supabase
      .from("deployment_targets")
      .select(TARGET_PUBLIC_COLUMNS)
      .eq("user_id", auth.userId!)
      .order("created_at", { ascending: false })
      .limit(MAX_TARGETS_PER_USER)

    if (error) return apiError("Failed to fetch deployment targets", 500)

    return apiSuccess({
      targets: (data ?? []).map((t: any) => ({ ...t, runner_online: runnerIsOnline(t.last_seen_at) })),
    })
  } catch (error) {
    console.error("[Deployment Targets API] GET error:", error)
    return apiError("Internal server error", 500)
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await validateAPIAuth(request, ["write:agents"])
    if (!auth.authenticated) return apiError(auth.error || "Authentication failed", auth.status || 401)

    let body: any
    try {
      body = await request.json()
    } catch {
      return apiError("Request body must be JSON", 400)
    }

    const name = typeof body?.name === "string" ? body.name.trim() : ""
    const targetType = body?.targetType ?? body?.target_type
    const securityProfile = body?.securityProfile ?? body?.security_profile ?? "standard"

    if (name.length < 1 || name.length > 120) return apiError("name must be 1-120 characters", 400)
    if (!TARGET_TYPES.includes(targetType)) {
      return apiError(`targetType must be one of: ${TARGET_TYPES.join(", ")}`, 400)
    }
    if (!SECURITY_PROFILES.includes(securityProfile)) {
      return apiError(`securityProfile must be one of: ${SECURITY_PROFILES.join(", ")}`, 400)
    }

    const supabase = await clientFor(auth.authMethod)

    const { count } = await supabase
      .from("deployment_targets")
      .select("id", { count: "exact", head: true })
      .eq("user_id", auth.userId!)
    if ((count ?? 0) >= MAX_TARGETS_PER_USER) {
      return apiError(`Target limit reached (${MAX_TARGETS_PER_USER}). Revoke unused targets first.`, 409)
    }

    const { token, hash } = generateRunnerToken()
    const { data, error } = await supabase
      .from("deployment_targets")
      .insert({
        user_id: auth.userId!,
        name,
        target_type: targetType,
        security_profile: securityProfile,
        token_hash: hash,
      })
      .select(TARGET_PUBLIC_COLUMNS)
      .single()

    if (error) {
      if (error.code === "23505") return apiError(`A target named "${name}" already exists`, 409)
      console.error("[Deployment Targets API] insert failed:", error.message)
      return apiError("Failed to register deployment target", 500)
    }

    return apiSuccess(
      {
        target: data,
        runnerToken: token,
        notice: "Store this token now. It is shown once and only its hash is kept.",
        nextSteps: [
          "Copy scripts/kronova-runner.mjs to the target machine",
          "Run: KRONOVA_RUNNER_TOKEN=<token> KRONOVA_URL=<base url> node kronova-runner.mjs",
        ],
      },
      201,
    )
  } catch (error) {
    console.error("[Deployment Targets API] POST error:", error)
    return apiError("Internal server error", 500)
  }
}
