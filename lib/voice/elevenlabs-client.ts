import { ElevenLabsClient as OfficialElevenLabsClient } from "@elevenlabs/elevenlabs-js"

// Voice configuration interface for text-to-speech
export interface ResendItVoiceConfig {
  voiceId: string
  modelId?: string
  stability?: number
  similarityBoost?: number
  style?: number
  useSpeakerBoost?: boolean
}

// Transcription result from speech-to-text
export interface TranscriptionResult {
  text: string
  confidence: number
  language: string
  duration: number
  segments?: Array<{
    text: string
    start: number
    end: number
    confidence: number
  }>
}

// Speech synthesis result from text-to-speech
export interface SpeechSynthesisResult {
  audioData: ArrayBuffer
  duration: number
  format: string
  voiceId: string
}

// Custom wrapper around official ElevenLabs SDK
export class ResendItVoiceClient {
  private client: OfficialElevenLabsClient
  private apiKey: string

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.ELEVENLABS_API_KEY || ""
    if (!this.apiKey) {
      throw new Error("ElevenLabs API key is required")
    }

    this.client = new OfficialElevenLabsClient({
      apiKey: this.apiKey,
    })
  }

  async transcribeAudio(audioDataOrUrl: ArrayBuffer | string, language?: string): Promise<TranscriptionResult> {
    try {
      const formData = new FormData()

      if (typeof audioDataOrUrl === "string") {
        // Use cloud_storage_url parameter (optimal for enterprise)
        formData.append("cloud_storage_url", audioDataOrUrl)
      } else {
        // Fallback to direct file upload
        const audioBlob = new Blob([audioDataOrUrl], { type: "audio/wav" })
        formData.append("file", audioBlob, "audio.wav")
      }

      formData.append("model_id", "scribe_v2") // Updated model_id from scribe_v2_realtime to scribe_v2 (correct API value)
      if (language) {
        formData.append("language_code", language)
      }

      const response = await fetch("https://api.elevenlabs.io/v1/speech-to-text", {
        method: "POST",
        headers: {
          "xi-api-key": this.apiKey,
        },
        body: formData,
      })

      if (!response.ok) {
        const error = await response.text()
        throw new Error(`ElevenLabs transcription failed: ${error}`)
      }

      const result = await response.json()

      const words: Array<{ text: string; start: number; end: number; type?: string; logprob?: number }> =
        Array.isArray(result.words) ? result.words.filter((word: { type?: string }) => word.type === "word") : []

      return {
        text: result.text,
        confidence: result.language_probability ?? 1.0,
        language: result.language_code || language || "en",
        duration: result.audio_duration_secs ?? words.at(-1)?.end ?? 0,
        segments: words.map((word) => ({
          text: word.text,
          start: word.start,
          end: word.end,
          confidence: typeof word.logprob === "number" ? Math.exp(word.logprob) : 1,
        })),
      }
    } catch (error) {
      console.error("[ResendItVoiceClient] Transcription error:", error)
      throw error
    }
  }

  async synthesizeSpeech(text: string, config: ResendItVoiceConfig): Promise<SpeechSynthesisResult> {
    try {
      const audioStream = await this.client.textToSpeech.convert(config.voiceId, {
        text,
        modelId: config.modelId || "eleven_multilingual_v2",
        voiceSettings: {
          stability: config.stability ?? 0.5,
          similarityBoost: config.similarityBoost ?? 0.75,
          style: config.style ?? 0.0,
          useSpeakerBoost: config.useSpeakerBoost ?? true,
        },
      })

      // Convert ReadableStream to ArrayBuffer
      const chunks: Uint8Array[] = []
      const reader = audioStream.getReader()

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        chunks.push(value)
      }

      // Combine all chunks into single ArrayBuffer
      const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0)
      const audioData = new Uint8Array(totalLength)
      let offset = 0
      for (const chunk of chunks) {
        audioData.set(chunk, offset)
        offset += chunk.length
      }

      return {
        audioData: audioData.buffer,
        duration: 0, // Would need to parse audio to get actual duration
        format: "mp3",
        voiceId: config.voiceId,
      }
    } catch (error) {
      console.error("[ResendItVoiceClient] Synthesis error:", error)
      throw error
    }
  }

  async getAvailableVoices(): Promise<Array<{ voice_id: string; name: string; category: string }>> {
    try {
      const voicesResponse = await this.client.voices.search()

      return voicesResponse.voices.map((voice) => ({
        voice_id: voice.voiceId,
        name: voice.name ?? voice.voiceId,
        category: voice.category || "generated",
      }))
    } catch (error) {
      console.error("[ResendItVoiceClient] Get voices error:", error)
      throw error
    }
  }

  async *streamSpeech(text: string, config: ResendItVoiceConfig): AsyncGenerator<ArrayBuffer> {
    try {
      const audioStream = await this.client.textToSpeech.stream(config.voiceId, {
        text,
        modelId: config.modelId || "eleven_flash_v2_5", // Use faster model for streaming
        voiceSettings: {
          stability: config.stability ?? 0.5,
          similarityBoost: config.similarityBoost ?? 0.75,
        },
      })

      const reader = audioStream.getReader()

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        yield value.slice().buffer
      }
    } catch (error) {
      console.error("[ResendItVoiceClient] Streaming error:", error)
      throw error
    }
  }
}

// Factory function to create voice client
export async function createResendItVoiceClient() {
  return new ResendItVoiceClient()
}

// Server action: Transcribe audio file
export async function transcribeAudioFile(audioData: ArrayBuffer, language?: string): Promise<TranscriptionResult> {
  const client = new ResendItVoiceClient()
  return await client.transcribeAudio(audioData, language)
}

// Server action: Synthesize speech
export async function synthesizeSpeechServer(
  text: string,
  config: ResendItVoiceConfig,
): Promise<SpeechSynthesisResult> {
  const client = new ResendItVoiceClient()
  return await client.synthesizeSpeech(text, config)
}
