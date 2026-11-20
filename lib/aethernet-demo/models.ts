import { anthropic } from "@ai-sdk/anthropic"
import { openai } from "@ai-sdk/openai"
import type { EmbeddingModel, LanguageModel } from "ai"

export interface ModelCandidate {
  label: string
  model: LanguageModel
}

export interface EmbeddingCandidate {
  label: string
  model: EmbeddingModel
}

/**
 * Each agent tries the Vercel AI Gateway first. When the gateway rejects the request (for example
 * the team has no credit balance), it retries once with the project's own provider key, so the
 * agents stay live instead of dropping straight to scripted text.
 */
export const BUYER_MODELS: ModelCandidate[] = [
  { label: "anthropic/claude-haiku-5.5", model: "anthropic/claude-haiku-5.5" },
  { label: "anthropic/claude-haiku-5.5 (direct key)", model: anthropic("claude-haiku-5-5") as unknown as LanguageModel },
]

export const SUPPLIER_MODELS: ModelCandidate[] = [
  { label: "google/gemini-3.5-flash", model: "google/gemini-3.5-flash" },
  { label: "anthropic/claude-sonnet-5.5 (direct key)", model: anthropic("claude-sonnet-5-5") as unknown as LanguageModel },
]

export const EMBEDDING_MODELS: EmbeddingCandidate[] = [
  { label: "openai/text-embedding-3-small", model: "openai/text-embedding-3-small" },
  {
    label: "openai/text-embedding-3-small (direct key)",
    model: openai.embedding("text-embedding-3-small") as unknown as EmbeddingModel,
  },
]

export async function runWithCandidates<M, T>(
  candidates: { label: string; model: M }[],
  run: (model: M) => Promise<T>,
): Promise<{ value: T; label: string } | null> {
  for (const candidate of candidates) {
    try {
      return { value: await run(candidate.model), label: candidate.label }
    } catch {
      continue
    }
  }
  return null
}
