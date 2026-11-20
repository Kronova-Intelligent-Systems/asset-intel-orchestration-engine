"use server"

import { createServerSupabaseClient } from "@/lib/supabase/server"
import { userSchema } from "@/lib/schemas"
import * as z from "zod"
import { redirect } from "next/navigation"

export async function loginWithEmailAndPassword(data: {
  email: string
  password: string
}) {
  const supabase = await createServerSupabaseClient()

  try {
    const { data: authData, error: signInError } = await supabase.auth.signInWithPassword({
      email: data.email,
      password: data.password,
    })

    if (signInError) {
      return { success: false, error: signInError.message }
    }

    if (!authData.user) {
      return { success: false, error: "Authentication failed" }
    }

    // Ensure profile exists (create if missing)
    const { data: profileData, error: profileError } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", authData.user.id)
      .maybeSingle()

    if (!profileData && (!profileError || profileError.code === "PGRST116")) {
      // Profile doesn't exist, create it
      const { error: insertError } = await supabase.from("profiles").insert({
        id: authData.user.id,
        user_id: authData.user.id,
        full_name: authData.user.user_metadata?.full_name || "",
        email: authData.user.email || "",
        company: authData.user.user_metadata?.company || "",
        job_title: authData.user.user_metadata?.job_title || "",
        website: authData.user.user_metadata?.website || "",
        linkedin_url: authData.user.user_metadata?.linkedin_url || "",
        username: (
          authData.user.user_metadata?.full_name ||
          authData.user.email?.split("@")[0] ||
          "user"
        )
          .toLowerCase()
          .replace(/\s+/g, "_"),
        updated_at: new Date().toISOString(),
      })

      if (insertError) {
        console.error("[v0] Error creating profile:", insertError)
        // Continue anyway - profile can be created later
      }
    }

    return { 
      success: true, 
      userId: authData.user.id,
      redirectTo: "/ai-suite" 
    }
  } catch (error) {
    console.error("[v0] Login error:", error)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : "An unexpected error occurred" 
    }
  }
}

export async function signInWithOAuth(provider: "google" | "github" | "apple") {
  const supabase = await createServerSupabaseClient()
  
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
  const redirectUrl = `${baseUrl}/auth/callback?redirect=/ai-suite`

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: redirectUrl,
    },
  })

  if (error) {
    return { success: false, error: error.message }
  }

  return { success: true, url: data.url }
}

const signUpSchema = userSchema.extend({
  password: z.string().min(8, "Password must be at least 8 characters long"),
})

export async function signUp(formData: z.infer<typeof signUpSchema>) {
  try {
    const validatedData = signUpSchema.parse(formData)

    // Ensure website has http/https prefix if provided
    let website = validatedData.website
    if (website && !website.startsWith("http")) {
      website = `https://${website}`
    }

    // Ensure linkedin_url has http/https prefix if provided
    let linkedinUrl = validatedData.linkedin_url
    if (linkedinUrl && !linkedinUrl.startsWith("http")) {
      linkedinUrl = `https://${linkedinUrl}`
    }

    const supabase = await createServerSupabaseClient()
    const { data, error } = await supabase.auth.signUp({
      email: validatedData.email,
      password: validatedData.password,
      options: {
        data: {
          full_name: validatedData.full_name,
          company: validatedData.company,
          job_title: validatedData.job_title || "",
          website: website,
          linkedin_url: linkedinUrl || "",
          avatar_url: validatedData.avatar_url || "",
          company_logo_url: validatedData.company_logo_url || "",
        },
        emailRedirectTo: `${
          process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
        }/auth/callback?redirect=/ai-suite`,
      },
    })

    if (error) throw error

    // Supabase returns an obfuscated user with no identities when the email is already registered.
    if (data.user && data.user.identities?.length === 0) {
      return {
        success: false,
        message: "An account with this email already exists. Please sign in instead.",
      }
    }

    // Create a profile record immediately after signup
    try {
      const { error: profileError } = await supabase.from("profiles").insert({
        id: data.user?.id,
        user_id: data.user?.id,
        full_name: validatedData.full_name,
        email: validatedData.email,
        company: validatedData.company,
        job_title: validatedData.job_title || "",
        website: website,
        linkedin_url: linkedinUrl || "",
        avatar_url: validatedData.avatar_url || "",
        company_logo_url: validatedData.company_logo_url || "",
        username: validatedData.full_name.toLowerCase().replace(/\s+/g, "_"),
        updated_at: new Date().toISOString(),
      })

      if (profileError) {
        console.error("Error creating profile:", profileError)
        // Continue even if profile creation fails, as it will be created later
      }
    } catch (profileError) {
      console.error("Error creating profile:", profileError)
      // Continue even if profile creation fails
    }

    return { success: true, message: "Account created successfully" }
  } catch (error) {
    console.error("Error signing up:", error)
    if (error instanceof z.ZodError) {
      return { success: false, message: error.issues[0].message }
    } else if (error instanceof Error) {
      return { success: false, message: error.message }
    } else {
      return { success: false, message: "There was an error creating your account. Please try again." }
    }
  }
}

export async function signOut() {
  try {
    const supabase = await createServerSupabaseClient()
    const { error } = await supabase.auth.signOut()

    if (error) {
      console.error("Error signing out:", error)
      throw error
    }
  } catch (error) {
    console.error("Error during sign out:", error)
    throw error
  }

  // Redirect to home page after successful sign out
  redirect("/")
}
