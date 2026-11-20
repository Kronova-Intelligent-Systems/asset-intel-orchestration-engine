/** Vector size of data_embeddings.vector_data and asset_intelligence_learning.vector_data. */
export const STORED_EMBEDDING_DIMENSIONS = 1536

/**
 * Embedding models the import pipeline can call through OpenAI.
 * `supportsDimensions` models are asked for exactly STORED_EMBEDDING_DIMENSIONS values,
 * so text-embedding-3-large fits the 1536-dimension column.
 */
export const SUPPORTED_EMBEDDING_MODELS: Record<string, { supportsDimensions: boolean }> = {
  "text-embedding-ada-002": { supportsDimensions: false },
  "text-embedding-3-small": { supportsDimensions: true },
  "text-embedding-3-large": { supportsDimensions: true },
}

export function isSupportedEmbeddingModel(modelId: string | null | undefined): boolean {
  return !!modelId && modelId in SUPPORTED_EMBEDDING_MODELS
}
