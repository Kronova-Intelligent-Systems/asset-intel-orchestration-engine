import { NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { engineReadyFor } from "@/lib/aethernet-demo/engine"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/** Tells the demo whether the signed-in user can run on AetherNet QUAS and KVS. Reveals nothing else. */
export async function GET() {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const ready = user ? await engineReadyFor({ id: user.id, email: user.email }) : false
  return NextResponse.json({ ready }, { headers: { "Cache-Control": "no-store" } })
}
