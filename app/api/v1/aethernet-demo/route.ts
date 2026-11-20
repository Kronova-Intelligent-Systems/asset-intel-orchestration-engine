/**
 * Kronova v1 AetherNet live demo.
 *
 * POST streams server-sent events while two LLM agents negotiate, seal, route and settle a purchase order
 * over a post-quantum A2A pipeline. Body: { "scenario": "clean" | "tamper" | "rogue" }.
 */

import type { NextRequest } from "next/server"
import { createAdminSupabaseClient } from "@/lib/supabase/admin"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { validateAPIAuth, apiError } from "@/lib/auth/api-auth"
import { engineReadyFor } from "@/lib/aethernet-demo/engine"
import { runDemo } from "@/lib/aethernet-demo/run"
import type { DemoEvent, EngineId, ScenarioId } from "@/lib/aethernet-demo/types"
import { PILOT } from "@/lib/pilot/config"

export const runtime = "nodejs"
export const maxDuration = 120

const SCENARIO_IDS: ScenarioId[] = ["clean", "tamper", "rogue"]
const MIN_INTERVAL_MS = 6_000
const lastRunByUser = new Map<string, number>()

export async function POST(request: NextRequest) {
  const auth = await validateAPIAuth(request, ["write:agents"])
  if (!auth.authenticated || !auth.userId) return apiError(auth.error || "Authentication failed", auth.status || 401)

  let scenario: ScenarioId = "clean"
  let engine: EngineId = "standin"
  try {
    const body = await request.json()
    if (SCENARIO_IDS.includes(body?.scenario)) scenario = body.scenario
    else if (body?.scenario !== undefined) return apiError("scenario must be clean, tamper or rogue", 400)
    if (body?.engine === "aethernet" || body?.engine === "standin") engine = body.engine
    else if (body?.engine !== undefined) return apiError("engine must be standin or aethernet", 400)
  } catch {
    // An empty body runs the clean scenario
  }

  if (engine === "aethernet") {
    const {
      data: { user },
    } = await (await createServerSupabaseClient()).auth.getUser()
    const ready = await engineReadyFor({ id: auth.userId, email: user?.email })
    if (!ready) {
      return apiError(`AetherNet QUAS and KVS access is provisioned through the enterprise pilot. Learn more at ${PILOT.url}.`, 403)
    }
  }

  const now = Date.now()
  if (now - (lastRunByUser.get(auth.userId) ?? 0) < MIN_INTERVAL_MS) {
    return apiError("A demo run just started. Wait a few seconds before running another.", 429)
  }
  lastRunByUser.set(auth.userId, now)

  const supabase = auth.authMethod === "api_key" ? createAdminSupabaseClient() : await createServerSupabaseClient()
  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: DemoEvent) => controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`))
      try {
        for await (const event of runDemo(scenario, { userId: auth.userId!, supabase, engine })) send(event)
      } catch (error) {
        console.error("[AetherNet demo] run failed:", error)
        send({ type: "error", message: "The demo run failed unexpectedly. Please try again." })
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  })
}
