import { NextResponse, type NextRequest } from "next/server"
import { apiError, validateAPIAuth } from "@/lib/auth/api-auth"
import { isModelOpsAdmin, opsDb } from "@/lib/model-ops/db"
import { applyRun, createRun } from "@/lib/model-ops/executor"

export const dynamic = "force-dynamic"
export const maxDuration = 300

async function requireAdmin(request: NextRequest) {
  const auth = await validateAPIAuth(request, ["write:agents"])
  if (!auth.authenticated || !auth.userId) return { error: apiError(auth.error || "Authentication failed", auth.status || 401) }
  if (!isModelOpsAdmin(auth.userId)) return { error: apiError("Model ops is restricted to platform administrators", 403) }
  return { userId: auth.userId }
}

export async function GET(request: NextRequest) {
  const access = await requireAdmin(request)
  if (access.error) return access.error
  const { data, error } = await opsDb()
    .from("model_ops_runs")
    .select("id, trigger, status, created_at, updated_at, plan_hash")
    .order("created_at", { ascending: false })
    .limit(20)
  if (error) return apiError("Could not list runs", 500)
  return NextResponse.json({ runs: data })
}

export async function POST(request: NextRequest) {
  const access = await requireAdmin(request)
  if (access.error) return access.error
  const body = (await request.json().catch(() => ({}))) as { autoApply?: unknown }

  try {
    const created = await createRun("api", access.userId!)
    if (body.autoApply !== true) return NextResponse.json({ run: created })
    const { run, refused } = await applyRun(created.id, { mode: "auto" })
    return NextResponse.json({ run, refused })
  } catch (error) {
    console.error("[model-ops] run failed", error)
    return apiError("Model ops run failed", 500)
  }
}
