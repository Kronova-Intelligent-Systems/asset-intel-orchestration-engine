import { NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { MANAGED_PROVIDERS } from "@/lib/ai/model-catalog"

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret || request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const supabase = await createServerSupabaseClient()

  try {
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - 90)

    // A model that an agent points at is never deactivated, however old it is.
    const { data: inUse, error: inUseError } = await supabase.from("ai_agents").select("model_id").not("model_id", "is", null)
    if (inUseError) {
      console.error("[cron/deactivate-stale-models]", inUseError)
      return NextResponse.json({ error: inUseError.message }, { status: 500 })
    }
    const protectedIds = [...new Set((inUse ?? []).map((row) => row.model_id as string))]

    let query = supabase
      .from("ai_models")
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq("is_active", true)
      .in("provider", [...MANAGED_PROVIDERS])
      .lt("updated_at", cutoff.toISOString())

    if (protectedIds.length > 0) {
      query = query.not("id", "in", `(${protectedIds.join(",")})`)
    }

    const { data, error } = await query.select("model_id, name, provider")

    if (error) {
      console.error("[cron/deactivate-stale-models]", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      ok: true,
      deactivated: data?.length ?? 0,
      protectedInUse: protectedIds.length,
      models: data?.map((m) => `${m.provider}/${m.model_id}`),
      cutoff: cutoff.toISOString(),
      timestamp: new Date().toISOString(),
    })
  } catch (err) {
    console.error("[cron/deactivate-stale-models]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
