import { type NextRequest, NextResponse } from "next/server"
import { validateDualAuth } from "@/lib/auth/dual-auth"
import { uploadVoiceAudio } from "@/lib/voice/voice-storage"

export async function POST(request: NextRequest) {
  try {
    console.log("[v0] [Voice Upload API] Starting upload request")

    // Validate authentication (supports both session and API key)
    const authResult = await validateDualAuth(request)
    if (!authResult.authenticated || !authResult.userId) {
      console.error("[v0] [Voice Upload API] Authentication failed:", authResult.error)
      return NextResponse.json({ error: authResult.error }, { status: 401 })
    }

    console.log("[v0] [Voice Upload API] Auth successful - User ID:", authResult.userId)

    const formData = await request.formData()
    const audioFile = formData.get("audio") as File
    const sessionId = formData.get("sessionId") as string

    console.log("[v0] [Voice Upload API] Session ID:", sessionId)
    console.log("[v0] [Voice Upload API] Audio file:", audioFile?.name, audioFile?.size, audioFile?.type)

    if (!audioFile || !sessionId) {
      console.error("[v0] [Voice Upload API] Missing required fields")
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    // Convert File to Blob
    const audioBlob = new Blob([await audioFile.arrayBuffer()], { type: audioFile.type })
    console.log("[v0] [Voice Upload API] Converted to blob:", audioBlob.size, audioBlob.type)

    // Upload to Supabase Storage and get signed URL (use authenticated user ID)
    const result = await uploadVoiceAudio(audioBlob, authResult.userId, sessionId)

    console.log("[v0] [Voice Upload API] Upload successful")

    return NextResponse.json({
      success: true,
      filePath: result.filePath,
      publicUrl: result.publicUrl,
      signedUrl: result.signedUrl,
    })
  } catch (error) {
    console.error("[v0] [Voice Upload API] Error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to upload audio" },
      { status: 500 },
    )
  }
}
