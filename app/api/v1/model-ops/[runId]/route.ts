import { NextResponse, type NextRequest } from "next/server"
import { apiError, validateAPIAuth } from "@/lib/auth/api-auth"
import { isModelOpsAdmin } from "@/lib/model-ops/db"
import { applyRun, loadRun } from "@/lib/model-ops/executor"

export const dynamic = "force-dynamic"
export const maxDuration = 300

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

async function requireAdmin(request: NextRequest) {
  const auth = await validateAPIAuth(request, ["write:agents"])
  if (!auth.authenticated || !auth.userId) return { error: apiError(auth.error || "Authentication failed", auth.status || 401) }
  if (!isModelOpsAdmin(auth.userId)) return { error: apiError("Model ops is restricted to platform administrators", 403) }
  return { userId: auth.userId }
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ runId: string }> }) {
  const access = await requireAdmin(request)
  if (access.error) return access.error
  const { runId } = await params
  if (!UUID.test(runId)) return apiError("Invalid run id", 400)
  const run = await loadRun(runId)
  return run ? NextResponse.json({ run }) : apiError("Run not found", 404)
}

/** Approves specific actions by id. Only actions in the signed plan can be selected. */
export async function POST(request: NextRequest, { params }: { params: Promise<{ runId: string }> }) {
  const access = await requireAdmin(request)
  if (access.error) return access.error
  const { runId } = await params
  if (!UUID.test(runId)) return apiError("Invalid run id", 400)

  const body = (await request.json().catch(() => ({}))) as { actionIds?: unknown }
  if (!Array.isArray(body.actionIds) || body.actionIds.length === 0 || !body.actionIds.every((id) => typeof id === "string")) {
    return apiError("actionIds must be a non-empty array of strings", 400)
  }

  try {
    const { run, refused } = await applyRun(runId, { mode: "approved", actionIds: body.actionIds as string[] })
    return refused ? NextResponse.json({ error: refused, run }, { status: 409 }) : NextResponse.json({ run })
  } catch (error) {
    console.error("[model-ops] approval failed", error)
    return apiError("Approval failed", 500)
  }
}
