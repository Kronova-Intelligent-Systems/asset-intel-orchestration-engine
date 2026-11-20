"use server"

import { createServerSupabaseClient } from "@/lib/supabase/server"
import { v4 as uuidv4 } from "uuid"

export async function ensureProfileHasPublicId(profileId: string) {
  const supabase = await createServerSupabaseClient()

  try {
    // Check if profile exists and has a public_id
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("public_id")
      .eq("id", profileId)
      .single()

    if (profileError) {
      console.error("Error fetching profile:", profileError)
      return { success: false, error: "Failed to fetch profile" }
    }

    // If profile already has a public_id, return it
    if (profile && profile.public_id) {
      return { success: true, public_id: profile.public_id }
    }

    // Generate a new public_id
    const public_id = uuidv4()

    // Update the profile with the new public_id
    const { error: updateError } = await supabase.from("profiles").update({ public_id }).eq("id", profileId)

    if (updateError) {
      console.error("Error updating profile with public_id:", updateError)
      return { success: false, error: "Failed to update profile with public_id" }
    }

    return { success: true, public_id }
  } catch (error) {
    console.error("Error in ensureProfileHasPublicId:", error)
    return {
      success: false,
      error: "An unexpected error occurred while ensuring profile has public_id",
    }
  }
}
