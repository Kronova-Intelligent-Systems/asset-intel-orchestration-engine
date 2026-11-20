import { timingSafeEqual } from "node:crypto"
import { NextResponse } from "next/server"
import { applyRun, createRun } from "@/lib/model-ops/executor"

export const dynamic = "force-dynamic"
export const maxDuration = 300

function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  const given = Buffer.from(request.headers.get("authorization") ?? "")
  const expected = Buffer.from(`Bearer ${secret}`)
  return given.length === expected.length && timingSafeEqual(given, expected)
}

export async function GET(request: Request) {
  if (!authorized(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    const created = await createRun("cron", null)
    const { run, refused } = await applyRun(created.id, { mode: "auto" })
    return NextResponse.json({
      runId: run.id,
      status: run.status,
      refused,
      awaitingApproval: run.plan.actions.filter((a) => !run.results.some((r) => r.actionId === a.id)).map((a) => ({ id: a.id, summary: a.summary })),
      results: run.results,
      notes: run.plan.notes,
    })
  } catch (error) {
    console.error("[cron/model-ops]", error)
    return NextResponse.json({ error: "Model ops run failed" }, { status: 500 })
  }
}
