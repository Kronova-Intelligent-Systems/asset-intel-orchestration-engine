import { createAdminSupabaseClient } from "@/lib/supabase/admin"
import { EmbeddingSystem, type Document } from "./embedding-system"

export interface ImportSource {
  fileName: string
  text: string
  fileType?: string
  fileSize?: number
  storagePath?: string
}

export interface ImportParams {
  userId: string
  jobId: string
  name: string
  description?: string
  embeddingModel: string
  chunkSize: number
  chunkOverlap: number
  sources: ImportSource[]
  addToLearningLayer: boolean
}

export interface ImportOutcome {
  datasetId: string
  chunkCount: number
  storedCount: number
  failedCount: number
  learningLayerId?: string
  warnings: string[]
}

const EXCERPT_COUNT = 3
const EXCERPT_LENGTH = 600

function averageVector(vectors: number[][]): number[] {
  const sum = new Array<number>(vectors[0].length).fill(0)
  for (const vector of vectors) {
    for (let i = 0; i < vector.length; i++) sum[i] += vector[i]
  }
  return sum.map((value) => value / vectors.length)
}

export async function runImportPipeline(params: ImportParams): Promise<ImportOutcome> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceKey) throw new Error("Missing Supabase configuration")

  const admin = createAdminSupabaseClient()
  const system = new EmbeddingSystem(supabaseUrl, serviceKey, params.embeddingModel)
  const warnings: string[] = []

  const documents: Document[] = []
  for (const source of params.sources) {
    documents.push(...(await system.processDocumentFile(source.text, source.fileName, params)))
  }
  if (documents.length === 0) throw new Error("No readable text was found in the provided data")

  const { data: dataset, error: datasetError } = await admin
    .from("embedding_datasets")
    .insert({
      name: params.name,
      description: params.description ?? null,
      user_id: params.userId,
      embedding_count: 0,
      metadata: {
        embedding_model: params.embeddingModel,
        chunk_size: params.chunkSize,
        chunk_overlap: params.chunkOverlap,
        source_files: params.sources.map(({ fileName, fileType, fileSize, storagePath }) => ({
          fileName,
          fileType,
          fileSize,
          storagePath,
        })),
      },
    })
    .select("id")
    .single()
  if (datasetError || !dataset) throw new Error(`Failed to create dataset: ${datasetError?.message}`)

  const results = await system.createEmbeddings(documents, params.userId, params.name, params.description, {
    datasetId: dataset.id,
    onProgress: async (processed, total) => {
      await admin
        .from("embedding_jobs")
        .update({ progress: Math.floor((processed / total) * 100) })
        .eq("id", params.jobId)
    },
  })

  const { stored, failed, errors } = system.lastRunStats
  if (failed > 0) {
    warnings.push(`${failed} of ${documents.length} chunks failed to embed: ${errors[0] ?? "unknown error"}`)
  }

  await admin.from("embedding_datasets").update({ embedding_count: stored }).eq("id", dataset.id)

  let learningLayerId: string | undefined
  if (params.addToLearningLayer && results.length > 0) {
    const excerpts = documents.slice(0, EXCERPT_COUNT).map((document) => document.content.slice(0, EXCERPT_LENGTH))
    const { data: learning, error: learningError } = await admin
      .from("asset_intelligence_learning")
      .insert({
        name: `Dataset: ${params.name}`,
        description: params.description ?? `Imported dataset with ${stored} embedded chunks`,
        execution_type: "dataset",
        execution_id: dataset.id,
        execution_name: params.name,
        asset_ids: [],
        asset_context: {},
        execution_input: {
          source_files: params.sources.map((source) => source.fileName),
          chunk_size: params.chunkSize,
          chunk_overlap: params.chunkOverlap,
        },
        execution_output: { chunk_count: stored, excerpts },
        execution_metrics: { failed_chunks: failed },
        embedding_model: params.embeddingModel,
        vector_data: averageVector(results.map((result) => result.embedding)),
        metadata: { dataset_id: dataset.id, source: "data_import" },
        tags: ["imported", "dataset"],
        user_id: params.userId,
      })
      .select("id")
      .single()

    if (learningError) {
      warnings.push(`Embeddings were saved but adding to the learning layer failed: ${learningError.message}`)
    } else {
      learningLayerId = learning.id
    }
  }

  return {
    datasetId: dataset.id,
    chunkCount: documents.length,
    storedCount: stored,
    failedCount: failed,
    learningLayerId,
    warnings,
  }
}
