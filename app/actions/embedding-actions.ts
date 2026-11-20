"use server"

import { createServerSupabaseClient } from "@/lib/supabase/server"
import { importFiles, importText } from "@/lib/embeddings/import-service"
import { JobQueue } from "@/lib/background-jobs/job-queue"
import { revalidatePath } from "next/cache"

// Get embeddings settings for a user
export async function getEmbeddingsSettings(userId: string) {
  const supabase = await createServerSupabaseClient()

  const { data, error } = await supabase
    .from("user_settings")
    .select("settings")
    .eq("user_id", userId)
    .eq("settings_type", "embeddings")
    .single()

  if (error) {
    if (error.code === "PGRST116") {
      return null
    }
    console.error("Error fetching embeddings settings:", error)
    throw new Error("Failed to fetch embeddings settings")
  }

  return data?.settings
}

// Save embeddings settings for a user
export async function saveEmbeddingsSettings(userId: string, settings: any) {
  const supabase = await createServerSupabaseClient()

  const { data, error } = await supabase
    .from("user_settings")
    .upsert({
      user_id: userId,
      settings_type: "embeddings",
      settings: settings,
    })
    .select()

  if (error) {
    console.error("Error saving embeddings settings:", error)
    throw new Error("Failed to save embeddings settings")
  }

  revalidatePath("/ai-suite/embeddings")
  return data
}

// Get RAG settings for a specific agent
export async function getRagSettings(userId: string, agentId: string) {
  const supabase = await createServerSupabaseClient()

  const { data, error } = await supabase
    .from("ai_agent_settings")
    .select("settings")
    .eq("user_id", userId)
    .eq("agent_id", agentId)
    .eq("settings_type", "rag")
    .single()

  if (error) {
    if (error.code === "PGRST116") {
      return null
    }
    console.error("Error fetching RAG settings:", error)
    throw new Error("Failed to fetch RAG settings")
  }

  return data?.settings
}

// Save RAG settings for a specific agent
export async function saveRagSettings(userId: string, agentId: string, settings: any) {
  const supabase = await createServerSupabaseClient()

  const { data, error } = await supabase
    .from("ai_agent_settings")
    .upsert({
      user_id: userId,
      agent_id: agentId,
      settings_type: "rag",
      settings: settings,
    })
    .select()

  if (error) {
    console.error("Error saving RAG settings:", error)
    throw new Error("Failed to save RAG settings")
  }

  revalidatePath("/ai-suite/embeddings")
  return data
}

// Upload files, extract their text, and create embeddings grouped into a dataset
export async function uploadFileForEmbedding(formData: FormData) {
  const result = await importFiles(formData)
  revalidatePath("/ai-suite/embeddings")
  return result
}

// Create embeddings from pasted text
export async function createEmbeddingFromText(data: {
  name: string
  description: string
  modelId: string
  chunkSize: number
  chunkOverlap: number
  textContent: string
  addToLearningLayer?: boolean
}) {
  const result = await importText(data)
  revalidatePath("/ai-suite/embeddings")
  return result
}

// Create embeddings from database - Now with robust background processing
export async function createEmbeddingsFromDatabase(data: {
  userId: string
  name: string
  description?: string
  modelId: string
  chunkSize: number
  chunkOverlap: number
  connectionId: string
  query: string
}): Promise<{ success: boolean; error?: string; jobId?: string }> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseServiceKey) {
    return { success: false, error: "Missing Supabase configuration" }
  }

  try {
    // Initialize job queue
    const jobQueue = new JobQueue(supabaseUrl, supabaseServiceKey)

    // Create background job
    const jobId = await jobQueue.createJob(
      "database_import",
      {
        name: data.name,
        description: data.description,
        modelId: data.modelId,
        chunkSize: data.chunkSize,
        chunkOverlap: data.chunkOverlap,
        connectionId: data.connectionId,
        query: data.query,
      },
      data.userId,
    )

    // Trigger background processing
    await jobQueue.triggerProcessing(jobId)

    revalidatePath("/ai-suite/embeddings")
    return { success: true, jobId }
  } catch (error: any) {
    console.error("Error creating database embedding job:", error)
    return { success: false, error: error.message || "Failed to create database embedding job" }
  }
}

// Get job status
export async function getJobStatus(jobId: string, userId: string) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error("Missing Supabase configuration")
  }

  const jobQueue = new JobQueue(supabaseUrl, supabaseServiceKey)
  return await jobQueue.getJobStatus(jobId, userId)
}

// Cancel job
export async function cancelJob(jobId: string, userId: string) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error("Missing Supabase configuration")
  }

  const jobQueue = new JobQueue(supabaseUrl, supabaseServiceKey)
  await jobQueue.cancelJob(jobId, userId)

  revalidatePath("/ai-suite/embeddings")
  return { success: true }
}

// Retry job
export async function retryJob(jobId: string, userId: string) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error("Missing Supabase configuration")
  }

  const jobQueue = new JobQueue(supabaseUrl, supabaseServiceKey)
  await jobQueue.retryJob(jobId, userId)

  revalidatePath("/ai-suite/embeddings")
  return { success: true }
}

// Update an embedding
export async function updateEmbedding(embeddingId: string, userId: string, updates: any) {
  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase
    .from("data_embeddings")
    .update(updates)
    .eq("id", embeddingId)
    .eq("user_id", userId)
    .select()
  if (error) {
    console.error("Error updating embedding:", error)
    throw new Error("Failed to update embedding")
  }
  revalidatePath("/ai-suite/embeddings")
  return data
}

// Delete an embedding
export async function deleteEmbedding(embeddingId: string, userId: string) {
  const supabase = await createServerSupabaseClient()
  const { data: files, error: filesError } = await supabase
    .from("embedding_files")
    .select("id, file_path")
    .eq("embedding_id", embeddingId)
  if (filesError) console.error("Error fetching embedding files:", filesError)
  else if (files && files.length > 0) {
    await supabase.storage.from("embedding_files").remove(files.map((f) => f.file_path))
    await supabase
      .from("embedding_files")
      .delete()
      .in(
        "id",
        files.map((f) => f.id),
      )
  }
  const { error } = await supabase.from("data_embeddings").delete().eq("id", embeddingId).eq("user_id", userId)
  if (error) {
    console.error("Error deleting embedding:", error)
    throw new Error("Failed to delete embedding")
  }
  revalidatePath("/ai-suite/embeddings")
  return { success: true }
}
