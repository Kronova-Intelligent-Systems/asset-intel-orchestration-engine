import { createServerSupabaseClient } from "@/lib/supabase/server"
import { type NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const public_id = searchParams.get("public_id") || "cddcb673-2728-4a63-961f-3503804a9e78"
  const user_id = searchParams.get("user_id")

  try {
    const supabase = await createServerSupabaseClient()

    // First check if a profile with this public_id already exists
    const { data: existingProfile, error: checkError } = await supabase
      .from("profiles")
      .select("id")
      .eq("public_id", public_id)
      .maybeSingle()

    if (checkError && checkError.code !== "PGRST116") {
      console.error("Error checking for existing profile:", checkError)
      return NextResponse.json({ error: checkError.message }, { status: 500 })
    }

    if (existingProfile) {
      return NextResponse.json({
        message: "Profile with this public_id already exists",
        profile_id: existingProfile.id,
      })
    }

    // If we have a user_id, use it, otherwise try to get the current user
    let profileId = user_id

    if (!profileId) {
      // Try to get the current user
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser()

      if (authError || !user) {
        return NextResponse.json(
          {
            error: "No user_id provided and not authenticated",
            auth_error: authError?.message,
          },
          { status: 400 },
        )
      }

      profileId = user.id
    }

    // Check if this user already has a profile
    const { data: userProfile, error: userProfileError } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", profileId)
      .maybeSingle()

    if (userProfileError && userProfileError.code !== "PGRST116") {
      console.error("Error checking for user profile:", userProfileError)
      return NextResponse.json({ error: userProfileError.message }, { status: 500 })
    }

    if (userProfile) {
      // Update existing profile with the new public_id
      const { error: updateError } = await supabase
        .from("profiles")
        .update({
          public_id,
          public_access: true,
          updated_at: new Date().toISOString(),
        })
        .eq("id", profileId)

      if (updateError) {
        console.error("Error updating profile:", updateError)
        return NextResponse.json({ error: updateError.message }, { status: 500 })
      }

      return NextResponse.json({
        success: true,
        message: "Updated existing profile with new public_id",
        profile_id: profileId,
        public_id,
      })
    } else {
      // Create a new profile with minimal data
      const { error: insertError } = await supabase.from("profiles").insert({
        id: profileId,
        user_id: profileId,
        public_id,
        public_access: true,
        full_name: "Kronova User",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })

      if (insertError) {
        console.error("Error creating profile:", insertError)
        return NextResponse.json({ error: insertError.message }, { status: 500 })
      }

      return NextResponse.json({
        success: true,
        message: "Created new profile with specified public_id",
        profile_id: profileId,
        public_id,
      })
    }
  } catch (error) {
    console.error("Unexpected error:", error)
    return NextResponse.json({ error: "An unexpected error occurred" }, { status: 500 })
  }
}
