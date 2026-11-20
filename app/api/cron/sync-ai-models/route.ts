import { NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { MODEL_CAPABILITIES, MODEL_MANIFEST } from "@/lib/ai/model-catalog"

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret || request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const supabase = await createServerSupabaseClient()
  const manifestIds = MODEL_MANIFEST.map((m) => m.model_id)
  const now = new Date().toISOString()

  try {
    const { data: existing, error: selectError } = await supabase
      .from("ai_models")
      .select("model_id")
      .in("model_id", manifestIds)

    if (selectError) {
      return NextResponse.json({ error: selectError.message }, { status: 500 })
    }

    const existingIds = new Set((existing ?? []).map((row) => row.model_id))
    const missing = MODEL_MANIFEST.filter((m) => !existingIds.has(m.model_id))

    // Existing rows keep their name, description and parameters; they are only reactivated and
    // re-stamped so the stale-model cron leaves them alone. Nothing outside the manifest is deactivated.
    const { error: touchError } = await supabase
      .from("ai_models")
      .update({ is_active: true, updated_at: now })
      .in("model_id", [...existingIds])

    const errors: string[] = []
    if (touchError) errors.push(`touch: ${touchError.message}`)

    let inserted = 0
    if (missing.length > 0) {
      const { error: insertError } = await supabase.from("ai_models").insert(
        missing.map((m) => ({
          provider: m.provider,
          model_id: m.model_id,
          name: m.name,
          description: m.description,
          capabilities: MODEL_CAPABILITIES,
          parameters: m.parameters,
          is_active: true,
          type: "chat",
          model_type: "chat",
        })),
      )
      if (insertError) errors.push(`insert: ${insertError.message}`)
      else inserted = missing.length
    }

    return NextResponse.json({
      ok: errors.length === 0,
      touched: existingIds.size,
      inserted,
      errors: errors.length ? errors : undefined,
      timestamp: now,
    })
  } catch (err) {
    console.error("[cron/sync-ai-models]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
