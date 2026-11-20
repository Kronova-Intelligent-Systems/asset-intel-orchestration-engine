import { type NextRequest, NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase/server"

async function validateAPIKey(apiKey: string) {
  const supabase = await createServerSupabaseClient()

  const { data: validationResult, error } = await supabase.rpc("validate_api_key", {
    api_key: apiKey,
  })

  if (error || !validationResult || validationResult.length === 0) {
    return { valid: false, error: "Invalid API key", status: 401 }
  }

  const result = validationResult[0]
  if (!result.valid) {
    return { valid: false, error: "Invalid or expired API key", status: 401 }
  }

  return { valid: true, userId: result.user_id }
}

// GET /api/v1/voice/sessions/[sessionId] - Get session details
export async function GET(request: NextRequest, { params }: { params: Promise<{ sessionId: string }> }) {
  try {
    const { sessionId } = await params
    const authHeader = request.headers.get("authorization")
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Missing authorization" }, { status: 401 })
    }

    const validation = await validateAPIKey(authHeader.substring(7))
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: validation.status })
    }

    const supabase = await createServerSupabaseClient()

    const { data: session, error } = await supabase
      .from("voice_sessions")
      .select("*")
      .eq("id", sessionId)
      .eq("user_id", validation.userId)
      .maybeSingle()

    if (error || !session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 })
    }

    // Get logs for this session
    const { data: logs } = await supabase
      .from("voice_execution_logs")
      .select("*")
      .eq("session_id", sessionId)
      .order("created_at", { ascending: false })
      .limit(50)

    return NextResponse.json({
      success: true,
      session,
      logs: logs || [],
      logCount: logs?.length || 0,
    })
  } catch (error) {
    console.error("[v0] Get session error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// PATCH /api/v1/voice/sessions/[sessionId] - Update session
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ sessionId: string }> }) {
  try {
    const { sessionId } = await params
    const authHeader = request.headers.get("authorization")
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Missing authorization" }, { status: 401 })
    }

    const validation = await validateAPIKey(authHeader.substring(7))
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: validation.status })
    }

    const body = await request.json()
    const { sessionName, isActive } = body

    const supabase = await createServerSupabaseClient()

    const updates: any = {}
    if (sessionName !== undefined) updates.session_name = sessionName
    if (isActive !== undefined) {
      updates.is_active = isActive
      if (!isActive) updates.ended_at = new Date().toISOString()
    }

    const { data: session, error } = await supabase
      .from("voice_sessions")
      .update(updates)
      .eq("id", sessionId)
      .eq("user_id", validation.userId)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: "Failed to update session" }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      session,
    })
  } catch (error) {
    console.error("[v0] Update session error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// DELETE /api/v1/voice/sessions/[sessionId] - Delete session
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ sessionId: string }> }) {
  try {
    const { sessionId } = await params
    const authHeader = request.headers.get("authorization")
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Missing authorization" }, { status: 401 })
    }

    const validation = await validateAPIKey(authHeader.substring(7))
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: validation.status })
    }

    const supabase = await createServerSupabaseClient()

    const { error } = await supabase
      .from("voice_sessions")
      .delete()
      .eq("id", sessionId)
      .eq("user_id", validation.userId)

    if (error) {
      return NextResponse.json({ error: "Failed to delete session" }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: "Session deleted successfully",
    })
  } catch (error) {
    console.error("[v0] Delete session error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
