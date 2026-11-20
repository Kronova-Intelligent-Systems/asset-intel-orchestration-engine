"use server"

import { createServerSupabaseClient } from "@/lib/supabase/server"

export interface VoiceStorageResult {
  filePath: string
  publicUrl: string
  signedUrl: string
}

/**
 * Ensure the voice-audio bucket exists, create it if not
 */
async function ensureVoiceAudioBucket() {
  try {
    const supabase = await createServerSupabaseClient()

    // Check if bucket exists by attempting to list files
    const { error: listError } = await supabase.storage.from("voice-audio").list("", {
      limit: 1,
    })

    // If bucket doesn't exist, we'll get a specific error
    if (listError && listError.message.includes("Bucket not found")) {
      console.log("[v0] [Voice Storage] Creating voice-audio bucket...")

      // Note: Supabase client doesn't provide createBucket in the JS SDK
      // We need to use the service role key via Supabase Management API
      // For now, we'll provide a clear error message
      throw new Error(
        "Voice audio storage bucket does not exist. Please create the 'voice-audio' bucket in your Supabase Storage dashboard with these settings:\n" +
          "- Name: voice-audio\n" +
          "- Public: No\n" +
          "- File size limit: 10MB\n" +
          "- Allowed MIME types: audio/wav, audio/webm, audio/mp3, audio/mpeg, audio/ogg, audio/opus\n" +
          "Then add RLS policies as defined in supabase/migrations/20250105_voice_audio_storage_bucket.sql",
      )
    }

    console.log("[v0] [Voice Storage] Bucket exists and is accessible")
  } catch (error) {
    console.error("[v0] [Voice Storage] Bucket check error:", error)
    throw error
  }
}

/**
 * Upload voice audio to Supabase Storage and return URLs
 * Uses signed URL for secure access by ElevenLabs API
 */
export async function uploadVoiceAudio(
  audioBlob: Blob,
  userId: string,
  sessionId: string,
): Promise<VoiceStorageResult> {
  try {
    console.log("[v0] [Voice Storage] Starting upload - userId:", userId, "sessionId:", sessionId)
    const supabase = await createServerSupabaseClient()

    await ensureVoiceAudioBucket()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError) {
      console.error("[v0] [Voice Storage] Auth error:", authError)
      throw new Error(`Authentication failed: ${authError.message}`)
    }

    if (!user) {
      console.error("[v0] [Voice Storage] No authenticated user found")
      throw new Error("Not authenticated")
    }

    // Use the authenticated user's ID instead of the passed userId for RLS compliance
    const authenticatedUserId = user.id
    console.log("[v0] [Voice Storage] Authenticated user ID:", authenticatedUserId)

    // Generate unique file name
    const timestamp = Date.now()
    const randomId = Math.random().toString(36).substring(2, 15)
    const fileName = `${timestamp}-${randomId}.wav`
    const filePath = `${authenticatedUserId}/${sessionId}/${fileName}`

    console.log("[v0] [Voice Storage] Uploading to path:", filePath)
    console.log("[v0] [Voice Storage] Blob size:", audioBlob.size, "bytes")
    console.log("[v0] [Voice Storage] Blob type:", audioBlob.type)

    // Upload to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from("voice-audio")
      .upload(filePath, audioBlob, {
        contentType: audioBlob.type || "audio/wav",
        cacheControl: "3600",
        upsert: false,
      })

    if (uploadError) {
      console.error("[v0] [Voice Storage] Upload error:", uploadError)
      console.error("[v0] [Voice Storage] Upload error details:", JSON.stringify(uploadError, null, 2))
      throw new Error(`Failed to upload audio: ${uploadError.message}`)
    }

    console.log("[v0] [Voice Storage] Upload successful:", uploadData)

    // Get public URL (for reference)
    const { data: urlData } = supabase.storage.from("voice-audio").getPublicUrl(filePath)
    console.log("[v0] [Voice Storage] Public URL:", urlData.publicUrl)

    // Create signed URL with 1 hour expiration (for ElevenLabs access)
    const { data: signedData, error: signedError } = await supabase.storage
      .from("voice-audio")
      .createSignedUrl(filePath, 3600) // 1 hour

    if (signedError) {
      console.error("[v0] [Voice Storage] Signed URL error:", signedError)
      throw new Error(`Failed to create signed URL: ${signedError.message}`)
    }

    console.log("[v0] [Voice Storage] Signed URL created successfully")

    return {
      filePath,
      publicUrl: urlData.publicUrl,
      signedUrl: signedData.signedUrl,
    }
  } catch (error) {
    console.error("[v0] [Voice Storage] Error:", error)
    throw error
  }
}

/**
 * Delete voice audio file from storage
 */
export async function deleteVoiceAudio(filePath: string): Promise<void> {
  try {
    const supabase = await createServerSupabaseClient()

    const { error } = await supabase.storage.from("voice-audio").remove([filePath])

    if (error) {
      console.error("[Voice Storage] Delete error:", error)
      throw new Error(`Failed to delete audio: ${error.message}`)
    }
  } catch (error) {
    console.error("[Voice Storage] Error:", error)
    throw error
  }
}

/**
 * Clean up old voice audio files (older than 7 days)
 */
export async function cleanupOldVoiceAudio(userId: string): Promise<number> {
  try {
    const supabase = await createServerSupabaseClient()

    // List all files for user
    const { data: files, error: listError } = await supabase.storage.from("voice-audio").list(userId)

    if (listError) {
      console.error("[Voice Storage] List error:", listError)
      throw new Error(`Failed to list audio files: ${listError.message}`)
    }

    // Filter files older than 7 days
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000
    const oldFiles = (files || [])
      .filter((file) => {
        if (!file.created_at) return false
        return new Date(file.created_at).getTime() < sevenDaysAgo
      })
      .map((file) => `${userId}/${file.name}`)

    if (oldFiles.length === 0) {
      return 0
    }

    // Delete old files
    const { error: deleteError } = await supabase.storage.from("voice-audio").remove(oldFiles)

    if (deleteError) {
      console.error("[Voice Storage] Cleanup error:", deleteError)
      throw new Error(`Failed to cleanup audio files: ${deleteError.message}`)
    }

    return oldFiles.length
  } catch (error) {
    console.error("[Voice Storage] Cleanup error:", error)
    return 0 // Don't throw, just log and return 0
  }
}
