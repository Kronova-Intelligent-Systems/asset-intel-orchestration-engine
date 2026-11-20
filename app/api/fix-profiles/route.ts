import { createServerSupabaseClient } from "@/lib/supabase/server"
import { type NextRequest, NextResponse } from "next/server"
import { v4 as uuidv4 } from "uuid"

export async function GET(request: NextRequest) {
  // This is an admin-only endpoint, so we should check for admin privileges
  // For now, we'll just check if the user is authenticated
  try {
    const supabase = await createServerSupabaseClient()

    // Get the current user
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Get all profiles without a public_id
    const { data: profiles, error: profilesError } = await supabase.from("profiles").select("id").is("public_id", null)

    if (profilesError) {
      return NextResponse.json({ error: profilesError.message }, { status: 500 })
    }

    // Update each profile with a new public_id
    const updates = []
    for (const profile of profiles || []) {
      const public_id = uuidv4()
      const { error } = await supabase
        .from("profiles")
        .update({
          public_id,
          public_access: true,
          updated_at: new Date().toISOString(),
        })
        .eq("id", profile.id)

      updates.push({
        id: profile.id,
        public_id,
        success: !error,
        error: error?.message,
      })
    }

    return NextResponse.json({
      fixed: updates.length,
      updates,
    })
  } catch (error) {
    console.error("Unexpected error in fix-profiles API:", error)
    return NextResponse.json({ error: "An unexpected error occurred" }, { status: 500 })
  }
}
