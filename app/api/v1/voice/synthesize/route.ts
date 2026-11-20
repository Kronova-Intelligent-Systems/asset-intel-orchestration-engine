import { type NextRequest, NextResponse } from "next/server"
import { validateDualAuth } from "@/lib/auth/dual-auth"
import { synthesizeSpeechAction } from "@/app/actions/voice-actions"
import type { ResendItVoiceConfig } from "@/lib/voice/elevenlabs-client"

// POST /api/v1/voice/synthesize - Text-to-speech synthesis
export async function POST(request: NextRequest) {
  try {
    const validation = await validateDualAuth(request, ["voice:synthesize"])

    if (!validation.authenticated) {
      return NextResponse.json(
        {
          error: validation.error,
          message:
            validation.authMethod === "session"
              ? "Please log in to use voice synthesis"
              : "Provide API key: Authorization: Bearer <your-api-key>",
        },
        { status: validation.status || 401 },
      )
    }

    const body = await request.json()
    const {
      text,
      voiceId = "EXAVITQu4vr4xnSDxMaL", // Default voice
      modelId = "eleven_multilingual_v2",
      stability = 0.5,
      similarityBoost = 0.75,
      style = 0.0,
      useSpeakerBoost = true,
    } = body

    if (!text) {
      return NextResponse.json({ error: "Missing required field: text" }, { status: 400 })
    }

    const config: ResendItVoiceConfig = {
      voiceId,
      modelId,
      stability,
      similarityBoost,
      style,
      useSpeakerBoost,
    }

    const result = await synthesizeSpeechAction(text, config)

    // Convert ArrayBuffer to base64
    const base64Audio = Buffer.from(result.audioData).toString("base64")

    return NextResponse.json({
      success: true,
      audioData: base64Audio,
      format: result.format,
      voiceId: result.voiceId,
      textLength: text.length,
      authMethod: validation.authMethod,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error("[v0] Synthesize error:", error)
    return NextResponse.json(
      {
        error: "Speech synthesis failed",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}
