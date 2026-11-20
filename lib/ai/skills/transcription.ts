/**
 * Audio input for the voice skills.
 *
 * Both voice skills accept either `voice_command` (text) or `audio_base64`. Audio is transcribed
 * with ElevenLabs speech-to-text and the transcript then flows through the same parsing as typed text.
 */

import { SkillError, type SkillPropertySchema } from "./types"

/** About 3 MB of audio once decoded. Keeps the JSON request under the 4.5 MB serverless body limit. */
export const MAX_AUDIO_BASE64_CHARS = 4_000_000
export const MAX_COMMAND_CHARS = 500

const STT_MODEL = "scribe_v2"
const STT_TIMEOUT_MS = 30_000
const BASE64_PATTERN = /^[A-Za-z0-9+/_-]+={0,2}$/

export const AUDIO_INPUT_PROPERTIES: Record<string, SkillPropertySchema> = {
  audio_base64: {
    type: "string",
    description:
      "Base64 encoded audio of the spoken command (mp3, wav, m4a, ogg, webm), up to about 3 MB. Use instead of voice_command. A data: URI prefix is accepted.",
    maxLength: MAX_AUDIO_BASE64_CHARS,
  },
  language: {
    type: "string",
    description: "Optional ISO 639 language code of the audio, for example en or es. Detected automatically when omitted.",
    maxLength: 8,
  },
}

export interface TranscriptionInfo {
  language: string
  duration_secs: number | null
  characters: number
  truncated: boolean
}

export interface ResolvedVoiceCommand {
  command: string
  /** Present only when the command came from audio. */
  transcription?: TranscriptionInfo
  warnings: string[]
}

function decodeAudio(audioBase64: string): Buffer {
  const encoded = audioBase64.replace(/^data:[^,]*;base64,/i, "").replace(/\s+/g, "")
  if (!encoded || !BASE64_PATTERN.test(encoded)) {
    throw new SkillError("INVALID_INPUT", "audio_base64 must be valid base64 encoded audio")
  }
  const audio = Buffer.from(encoded, "base64")
  if (audio.length === 0) throw new SkillError("INVALID_INPUT", "audio_base64 is empty")
  return audio
}

async function transcribe(audio: Buffer, language?: string): Promise<{ text: string; language: string; duration: number | null }> {
  const apiKey = process.env.ELEVENLABS_API_KEY
  if (!apiKey) {
    throw new SkillError("UNSUPPORTED", "Audio transcription is not configured on this deployment. Send voice_command as text instead.")
  }

  const form = new FormData()
  form.append("file", new Blob([new Uint8Array(audio)], { type: "application/octet-stream" }), "command-audio")
  form.append("model_id", STT_MODEL)
  if (language) form.append("language_code", language)

  let response: Response
  try {
    response = await fetch("https://api.elevenlabs.io/v1/speech-to-text", {
      method: "POST",
      headers: { "xi-api-key": apiKey },
      body: form,
      signal: AbortSignal.timeout(STT_TIMEOUT_MS),
    })
  } catch {
    throw new SkillError("INTERNAL", "Audio transcription timed out or was unreachable. Try again or send voice_command as text.")
  }

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { detail?: { status?: string; code?: string } | string } | null
    const code = typeof body?.detail === "object" ? (body.detail?.status ?? body.detail?.code) : undefined
    if (response.status === 400 || response.status === 422) {
      throw new SkillError("INVALID_INPUT", "The audio could not be read. Send a standard audio file such as mp3, wav, m4a or ogg.")
    }
    throw new SkillError("INTERNAL", `Audio transcription failed (HTTP ${response.status}${code ? `, ${code}` : ""}).`)
  }

  const result = (await response.json()) as {
    text?: string
    language_code?: string
    audio_duration_secs?: number
  }
  return {
    text: (result.text ?? "").trim(),
    language: result.language_code ?? language ?? "unknown",
    duration: typeof result.audio_duration_secs === "number" ? result.audio_duration_secs : null,
  }
}

/** Returns the command text, transcribing audio when that is what the caller sent. */
export async function resolveVoiceCommand(input: Record<string, any>): Promise<ResolvedVoiceCommand> {
  const hasText = typeof input.voice_command === "string" && input.voice_command.trim().length > 0
  const hasAudio = typeof input.audio_base64 === "string" && input.audio_base64.length > 0

  if (hasText && hasAudio) {
    throw new SkillError("INVALID_INPUT", "Send either voice_command or audio_base64, not both")
  }
  if (!hasText && !hasAudio) {
    throw new SkillError("INVALID_INPUT", "Missing required input: send voice_command (text) or audio_base64 (audio)")
  }
  if (hasText) return { command: input.voice_command.trim(), warnings: [] }

  const { text, language, duration } = await transcribe(decodeAudio(input.audio_base64), input.language)
  if (!text) {
    throw new SkillError("INVALID_INPUT", "No speech was detected in the audio", { language, duration_secs: duration })
  }

  const truncated = text.length > MAX_COMMAND_CHARS
  return {
    command: truncated ? text.slice(0, MAX_COMMAND_CHARS) : text,
    transcription: { language, duration_secs: duration, characters: text.length, truncated },
    warnings: truncated ? [`The transcript was ${text.length} characters; only the first ${MAX_COMMAND_CHARS} were used.`] : [],
  }
}
