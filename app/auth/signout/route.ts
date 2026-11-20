import { createServerSupabaseClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"

export async function POST() {
  const supabase = await createServerSupabaseClient()
  await supabase.auth.signOut()
  return redirect("/")
}
