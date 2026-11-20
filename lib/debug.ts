"use server"

import { createServerSupabaseClient } from "@/lib/supabase/server"

export async function debugProfile(userId: string) {
  const supabase = await createServerSupabaseClient()

  try {
    // Get profile data
    const { data: profile, error: profileError } = await supabase.from("profiles").select("*").eq("id", userId).single()

    if (profileError) {
      console.error("Error fetching profile:", profileError)
      return { success: false, error: profileError.message }
    }

    // Get user metadata
    const { data: userData, error: userError } = await supabase.auth.getUser()

    if (userError) {
      console.error("Error fetching user:", userError)
      return { success: false, error: userError.message }
    }

    // Return both profile and user metadata for comparison
    return {
      success: true,
      profile,
      userMetadata: userData.user?.user_metadata,
    }
  } catch (error) {
    console.error("Error in debugProfile:", error)
    return { success: false, error: "An unexpected error occurred" }
  }
}
