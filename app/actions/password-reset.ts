"use server"

import { createServerSupabaseClient } from "@/lib/supabase/server"
import { z } from "zod"

const emailSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
})

export async function requestPasswordReset(formData: FormData) {
  try {
    const email = formData.get("email") as string
    const validatedData = emailSchema.parse({ email })

    const supabase = await createServerSupabaseClient()

    const { error } = await supabase.auth.resetPasswordForEmail(validatedData.email, {
      redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/reset-password`,
    })

    if (error) {
      return { success: false, message: error.message }
    }

    return {
      success: true,
      message: "If an account exists with this email, you will receive password reset instructions.",
    }
  } catch (error) {
    console.error("Error requesting password reset:", error)
    if (error instanceof z.ZodError) {
      return { success: false, message: error.issues[0].message }
    }
    return {
      success: false,
      message: "An error occurred. Please try again.",
    }
  }
}

export async function resetPassword(formData: FormData) {
  try {
    const password = formData.get("password") as string
    const confirmPassword = formData.get("confirmPassword") as string

    if (password !== confirmPassword) {
      return { success: false, message: "Passwords do not match" }
    }

    if (password.length < 8) {
      return { success: false, message: "Password must be at least 8 characters long" }
    }

    const supabase = await createServerSupabaseClient()

    const { error } = await supabase.auth.updateUser({
      password,
    })

    if (error) {
      return { success: false, message: error.message }
    }

    return {
      success: true,
      message: "Your password has been reset successfully. You can now log in with your new password.",
    }
  } catch (error) {
    console.error("Error resetting password:", error)
    return {
      success: false,
      message: "An error occurred while resetting your password. Please try again.",
    }
  }
}
