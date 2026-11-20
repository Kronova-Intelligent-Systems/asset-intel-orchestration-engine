import { AIClient } from "../ai/ai-client"
import { createClient } from "@supabase/supabase-js"
import type { DataEmbedding } from "../types/database"
import { chunkText } from "./chunker"
import { STORED_EMBEDDING_DIMENSIONS, SUPPORTED_EMBEDDING_MODELS, isSupportedEmbeddingModel } from "./supported-models"

// Define the document interface
export interface Document {
  id: string
  content: string
  metadata?: Record<string, any>
}

// Define the embedding result interface
export interface EmbeddingResult {
  id: string
  embedding: number[]
  metadata: Record<string, any>
}

// Define the search result interface
export interface SearchResult {
  id: string
  content: string
  metadata: Record<string, any>
  similarity: number
}

export interface EmbeddingRunStats {
  requested: number
  stored: number
  failed: number
  errors: string[]
}

export interface CreateEmbeddingsOptions {
  datasetId?: string
  sourceType?: string
  onProgress?: (processed: number, total: number) => Promise<void> | void
}

const BATCH_SIZE = 64
const MAX_ATTEMPTS = 3

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

// Embedding system class
export class EmbeddingSystem {
  private supabase: any
  private aiClient: AIClient
  private embeddingModel: string
  private embeddingDimensions: number
  lastRunStats: EmbeddingRunStats = { requested: 0, stored: 0, failed: 0, errors: [] }

  constructor(
    supabaseUrl: string,
    supabaseKey: string,
    embeddingModel = "text-embedding-ada-002",
    dimensions = STORED_EMBEDDING_DIMENSIONS,
  ) {
    this.supabase = createClient(supabaseUrl, supabaseKey)
    this.aiClient = new AIClient("openai", process.env.OPENAI_API_KEY || "", embeddingModel)
    this.embeddingModel = embeddingModel
    this.embeddingDimensions = dimensions
  }

  private assertSupportedModel() {
    if (!isSupportedEmbeddingModel(this.embeddingModel)) {
      throw new Error(
        `Embedding model "${this.embeddingModel}" is not supported for imports. Use one of: ${Object.keys(SUPPORTED_EMBEDDING_MODELS).join(", ")}.`,
      )
    }
  }

  /** Embeds several texts in one request, retrying transient failures, and validates every vector's size. */
  private async embedBatch(inputs: string[]): Promise<number[][]> {
    this.assertSupportedModel()
    const requestDimensions = SUPPORTED_EMBEDDING_MODELS[this.embeddingModel].supportsDimensions
      ? { dimensions: this.embeddingDimensions }
      : {}

    for (let attempt = 0; ; attempt++) {
      try {
        const response = await this.aiClient.createEmbedding({
          model: this.embeddingModel,
          input: inputs,
          ...requestDimensions,
        })
        const vectors = [...response.data]
          .sort((a: any, b: any) => (a.index ?? 0) - (b.index ?? 0))
          .map((item) => item.embedding)

        if (vectors.length !== inputs.length) {
          throw new Error(`Expected ${inputs.length} embeddings but received ${vectors.length}`)
        }
        const wrongSize = vectors.find((vector) => vector.length !== this.embeddingDimensions)
        if (wrongSize) {
          throw new Error(
            `Model returned ${wrongSize.length} dimensions but the database stores ${this.embeddingDimensions}`,
          )
        }
        return vectors
      } catch (error) {
        if (attempt >= MAX_ATTEMPTS - 1) throw error
        await sleep(500 * 2 ** attempt)
      }
    }
  }

  // Create embeddings for documents with batched requests and batched inserts
  async createEmbeddings(
    documents: Document[],
    userId: string,
    name: string,
    description?: string,
    options: CreateEmbeddingsOptions = {},
  ): Promise<EmbeddingResult[]> {
    this.assertSupportedModel()
    const embeddings: EmbeddingResult[] = []
    const stats: EmbeddingRunStats = { requested: documents.length, stored: 0, failed: 0, errors: [] }
    this.lastRunStats = stats

    for (let i = 0; i < documents.length; i += BATCH_SIZE) {
      const batch = documents.slice(i, i + BATCH_SIZE)

      try {
        const vectors = await this.embedBatch(batch.map((document) => document.content))

        const rows = batch.map((document, index) => ({
          name,
          description,
          source_type: options.sourceType ?? "document",
          source_id: document.id,
          embedding_model: this.embeddingModel,
          vector_data: vectors[index],
          metadata: {
            ...document.metadata,
            content: document.content,
            batchIndex: Math.floor(i / BATCH_SIZE),
          },
          user_id: userId,
          dataset_id: options.datasetId ?? null,
        }))

        const { data, error } = await this.supabase.from("data_embeddings").insert(rows).select("id")
        if (error) throw new Error(error.message)

        data.forEach((row: { id: string }, index: number) => {
          embeddings.push({
            id: row.id,
            embedding: vectors[index],
            metadata: { ...batch[index].metadata, content: batch[index].content },
          })
        })
        stats.stored += batch.length
      } catch (error: any) {
        stats.failed += batch.length
        if (stats.errors.length < 5) stats.errors.push(error?.message ?? String(error))
        console.error(`Error embedding batch starting at ${i}:`, error)
      }

      await options.onProgress?.(Math.min(i + BATCH_SIZE, documents.length), documents.length)
    }

    if (documents.length > 0 && stats.stored === 0) {
      throw new Error(`No embeddings were stored. ${stats.errors[0] ?? "Unknown error"}`)
    }

    return embeddings
  }

  // Search for similar documents
  async searchSimilarDocuments(query: string, userId: string, limit = 5, threshold = 0.7): Promise<SearchResult[]> {
    const [queryEmbedding] = await this.embedBatch([query])

    const { data, error } = await this.supabase.rpc("match_embeddings", {
      query_embedding: queryEmbedding,
      match_threshold: threshold,
      match_count: limit,
      user_id: userId,
    })

    if (error) {
      console.error("Error searching for similar documents:", error)
      throw error
    }

    return data.map((item: any) => ({
      id: item.id,
      content: item.content,
      metadata: item.metadata,
      similarity: item.similarity,
    }))
  }

  // Process a document file and create chunks
  async processDocumentFile(
    fileContent: string,
    fileName: string,
    options: {
      chunkSize: number
      chunkOverlap: number
    },
  ): Promise<Document[]> {
    return chunkText(fileContent, options).map((chunk, chunkIndex) => ({
      id: `${fileName}-chunk-${chunkIndex}`,
      content: chunk.content,
      metadata: {
        fileName,
        chunkIndex,
        startIndex: chunk.start,
        endIndex: chunk.end,
        fileSize: fileContent.length,
      },
    }))
  }

  // Get all embeddings for a user
  async getUserEmbeddings(userId: string): Promise<DataEmbedding[]> {
    const { data, error } = await this.supabase.from("data_embeddings").select("*").eq("user_id", userId)

    if (error) {
      console.error("Error fetching user embeddings:", error)
      throw error
    }

    return data
  }

  // Delete an embedding
  async deleteEmbedding(embeddingId: string, userId: string): Promise<void> {
    const { error } = await this.supabase.from("data_embeddings").delete().eq("id", embeddingId).eq("user_id", userId)

    if (error) {
      console.error("Error deleting embedding:", error)
      throw error
    }
  }

  // Update an embedding
  async updateEmbedding(
    embeddingId: string,
    userId: string,
    updates: { name?: string; description?: string; metadata?: Record<string, any> },
  ): Promise<DataEmbedding> {
    const { data, error } = await this.supabase
      .from("data_embeddings")
      .update(updates)
      .eq("id", embeddingId)
      .eq("user_id", userId)
      .select()

    if (error) {
      console.error("Error updating embedding:", error)
      throw error
    }

    return data[0]
  }

  // Generate embedding for a single text input
  async generateEmbedding(text: string): Promise<number[]> {
    const [embedding] = await this.embedBatch([text])
    return embedding
  }
}
