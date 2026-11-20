import { createServerSupabaseClient } from "@/lib/supabase/server"
import { type NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const public_id = searchParams.get("public_id")
  const user_id = searchParams.get("user_id")

  if (!public_id && !user_id) {
    return NextResponse.json({ error: "No public_id or user_id provided" }, { status: 400 })
  }

  try {
    const supabase = await createServerSupabaseClient()
    let query = supabase.from("profiles").select("*")

    if (public_id) {
      query = query.eq("public_id", public_id)
    } else if (user_id) {
      query = query.eq("id", user_id)
    }

    const { data, error } = await query.maybeSingle()

    if (error) {
      console.error("Error fetching profile:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // If in production, remove sensitive data
    if (process.env.NODE_ENV === "production" && data) {
      delete data.email
      // Remove other sensitive fields as needed
    }

    return NextResponse.json({ profile: data || null })
  } catch (error) {
    console.error("Unexpected error in debug-profile API:", error)
    return NextResponse.json({ error: "An unexpected error occurred" }, { status: 500 })
  }
}
