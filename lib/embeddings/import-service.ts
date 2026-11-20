import { createServerSupabaseClient } from "@/lib/supabase/server"
import { createAdminSupabaseClient } from "@/lib/supabase/admin"
import { extractTextFromFile } from "./text-extraction"
import { isSupportedEmbeddingModel, SUPPORTED_EMBEDDING_MODELS } from "./supported-models"
import { runImportPipeline, type ImportOutcome, type ImportSource } from "./import-pipeline"

const MAX_FILE_SIZE = 100 * 1024 * 1024
const MAX_TEXT_LENGTH = 10 * 1024 * 1024
const BUCKET = "embedding_files"

interface ImportSettings {
  name: string
  description: string
  modelId: string
  chunkSize: number
  chunkOverlap: number
  addToLearningLayer: boolean
}

export interface ImportResult extends ImportOutcome {
  success: true
  skippedFiles: string[]
}

async function requireUser() {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error("You must be signed in to import data")
  return { supabase, user }
}

async function resolveEmbeddingModel(supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>, id: string) {
  const { data, error } = await supabase.from("ai_models").select("model_id, provider").eq("id", id).single()
  if (error || !data) throw new Error("The selected embedding model could not be found")
  if (!isSupportedEmbeddingModel(data.model_id)) {
    throw new Error(
      `${data.provider}/${data.model_id} is not supported for imports yet. Choose one of: ${Object.keys(SUPPORTED_EMBEDDING_MODELS).join(", ")}.`,
    )
  }
  return data.model_id as string
}

function clampSettings(raw: ImportSettings): ImportSettings {
  const chunkSize = Math.min(Math.max(Math.floor(raw.chunkSize) || 1000, 200), 8000)
  const chunkOverlap = Math.min(Math.max(Math.floor(raw.chunkOverlap) || 0, 0), Math.floor(chunkSize / 2))
  return { ...raw, chunkSize, chunkOverlap }
}

async function uploadOriginal(userId: string, file: File): Promise<{ path?: string; warning?: string }> {
  const admin = createAdminSupabaseClient()
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_")
  const path = `${userId}/${Date.now()}-${safeName}`

  let { error } = await admin.storage.from(BUCKET).upload(path, file, { upsert: false })
  if (error?.message?.toLowerCase().includes("bucket not found")) {
    await admin.storage.createBucket(BUCKET, { public: false })
    ;({ error } = await admin.storage.from(BUCKET).upload(path, file, { upsert: false }))
  }
  if (error) return { warning: `${file.name}: original could not be stored (${error.message})` }

  await admin.from("embedding_files").insert({
    file_name: file.name,
    file_type: file.type,
    file_size: file.size,
    file_path: path,
    user_id: userId,
  })
  return { path }
}

async function runJob(
  userId: string,
  jobType: string,
  settings: ImportSettings,
  parameters: Record<string, unknown>,
  prepare: (embeddingModel: string) => Promise<{ sources: ImportSource[]; skippedFiles: string[]; warnings: string[] }>,
): Promise<ImportResult> {
  const { supabase } = await requireUser()
  const embeddingModel = await resolveEmbeddingModel(supabase, settings.modelId)
  const admin = createAdminSupabaseClient()

  const { data: job, error: jobError } = await admin
    .from("embedding_jobs")
    .insert({
      job_type: jobType,
      status: "processing",
      parameters: { ...parameters, name: settings.name, modelId: settings.modelId, embeddingModel },
      user_id: userId,
      progress: 0,
      processing_started_at: new Date().toISOString(),
    })
    .select("id")
    .single()
  if (jobError || !job) throw new Error(`Failed to create embedding job: ${jobError?.message}`)

  try {
    const { sources, skippedFiles, warnings } = await prepare(embeddingModel)
    if (sources.length === 0) {
      throw new Error(`No readable text found. ${skippedFiles.join("; ")}`.trim())
    }

    const outcome = await runImportPipeline({
      userId,
      jobId: job.id,
      name: settings.name,
      description: settings.description,
      embeddingModel,
      chunkSize: settings.chunkSize,
      chunkOverlap: settings.chunkOverlap,
      sources,
      addToLearningLayer: settings.addToLearningLayer,
    })
    outcome.warnings.unshift(...warnings, ...skippedFiles.map((message) => `Skipped ${message}`))

    await admin
      .from("embedding_jobs")
      .update({
        status: "completed",
        progress: 100,
        processing_completed_at: new Date().toISOString(),
        result: { ...outcome },
      })
      .eq("id", job.id)

    return { success: true, skippedFiles, ...outcome }
  } catch (error: any) {
    await admin
      .from("embedding_jobs")
      .update({ status: "failed", error: error.message, processing_completed_at: new Date().toISOString() })
      .eq("id", job.id)
    throw error
  }
}

export async function importFiles(formData: FormData): Promise<ImportResult> {
  const { user } = await requireUser()
  const files = formData.getAll("files").filter((entry): entry is File => entry instanceof File)
  if (files.length === 0) throw new Error("Select at least one file to import")

  const oversized = files.filter((file) => file.size > MAX_FILE_SIZE)
  if (oversized.length > 0) {
    throw new Error(`Files exceed the 100MB limit: ${oversized.map((file) => file.name).join(", ")}`)
  }

  const name = String(formData.get("name") ?? "").trim()
  if (!name) throw new Error("Provide a name for your embeddings")

  const settings = clampSettings({
    name,
    description: String(formData.get("description") ?? ""),
    modelId: String(formData.get("modelId") ?? ""),
    chunkSize: Number.parseInt(String(formData.get("chunkSize"))),
    chunkOverlap: Number.parseInt(String(formData.get("chunkOverlap"))),
    addToLearningLayer: formData.get("addToLearningLayer") === "true",
  })

  return runJob(user.id, "file_upload", settings, { fileCount: files.length }, async () => {
    const sources: ImportSource[] = []
    const skippedFiles: string[] = []
    const warnings: string[] = []

    for (const file of files) {
      try {
        const text = await extractTextFromFile(file)
        if (!text) throw new Error("no readable text (scanned or image-only documents are not supported)")
        const { path, warning } = await uploadOriginal(user.id, file)
        if (warning) warnings.push(warning)
        sources.push({ fileName: file.name, text, fileType: file.type, fileSize: file.size, storagePath: path })
      } catch (error: any) {
        skippedFiles.push(`${file.name}: ${error.message}`)
      }
    }
    return { sources, skippedFiles, warnings }
  })
}

export async function importText(input: {
  name: string
  description: string
  modelId: string
  chunkSize: number
  chunkOverlap: number
  textContent: string
  addToLearningLayer?: boolean
}): Promise<ImportResult> {
  const { user } = await requireUser()
  const name = input.name.trim()
  if (!name) throw new Error("Provide a name for your embeddings")
  if (!input.textContent.trim()) throw new Error("Enter some text to embed")
  if (input.textContent.length > MAX_TEXT_LENGTH) throw new Error("Text content exceeds the 10MB limit")

  const settings = clampSettings({
    name,
    description: input.description,
    modelId: input.modelId,
    chunkSize: input.chunkSize,
    chunkOverlap: input.chunkOverlap,
    addToLearningLayer: input.addToLearningLayer === true,
  })

  return runJob(user.id, "text_input", settings, { textLength: input.textContent.length }, async () => ({
    sources: [{ fileName: "text-input.txt", text: input.textContent.trim(), fileType: "text/plain" }],
    skippedFiles: [],
    warnings: [],
  }))
}
