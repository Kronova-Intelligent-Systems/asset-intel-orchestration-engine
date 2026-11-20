import { cosineSimilarity, embedMany } from "ai"
import { EMBEDDING_MODELS, runWithCandidates } from "./models"

/**
 * Open-source stand-in for AetherNet KVS. It runs the same operation (semantic counterparty
 * lookup by embedding similarity) in process memory. KVS runs it inside a hardened enclave
 * over FIPS-203 + AES-256-GCM encrypted vectors.
 */

interface CounterpartyRecord {
  label: string
  profile: string
  reliability: number
}

const CORPUS: CounterpartyRecord[] = [
  {
    label: "Aerospace OEM",
    profile:
      "Aerospace OEM, 41 prior cross-border settlements, zero disputes, pays within two days of delivery attestation, always funds escrow",
    reliability: 96,
  },
  {
    label: "Defense integrator",
    profile:
      "Defense electronics integrator, 19 settlements, zero disputes, government-backed credit line, strict compliance",
    reliability: 94,
  },
  {
    label: "Semiconductor buyer",
    profile: "Semiconductor equipment buyer, 22 settlements, zero disputes, pays early, multi-year supply agreements",
    reliability: 93,
  },
  {
    label: "Tier-1 automotive",
    profile: "Tier-1 automotive buyer, 28 settlements, one minor dispute resolved in three days, consistent escrow funding",
    reliability: 91,
  },
  {
    label: "Medical device maker",
    profile: "Medical device contract manufacturer, 33 settlements, one inspection dispute, otherwise prompt payment",
    reliability: 88,
  },
  {
    label: "Machinery distributor",
    profile: "Industrial machinery distributor, 12 settlements, three payments late by more than 30 days, thin working capital",
    reliability: 52,
  },
  {
    label: "Commodity broker",
    profile: "Commodity broker, 9 settlements, repeated partial payments, two reversed transfers",
    reliability: 35,
  },
  {
    label: "Unverified shell",
    profile: "Newly formed trading company, 2 settlements, unverified beneficial owners, unusual payment routing",
    reliability: 18,
  },
]

export interface KvsNeighbor {
  label: string
  similarity: number
  reliability: number
}

export interface KvsResult {
  score: number
  neighbors: KvsNeighbor[]
  dimensions: number
  model: string
  fallback: boolean
}

function bagOfWords(text: string, vocabulary: string[]): number[] {
  const words = text.toLowerCase().match(/[a-z]+/g) ?? []
  return vocabulary.map((term) => words.filter((word) => word === term).length)
}

async function embedAll(texts: string[]): Promise<{ vectors: number[][]; fallback: boolean; label: string }> {
  const live = await runWithCandidates(EMBEDDING_MODELS, async (model) => {
    const { embeddings } = await embedMany({ model, values: texts, abortSignal: AbortSignal.timeout(15000) })
    return embeddings
  })
  if (live) return { vectors: live.value, fallback: false, label: live.label }

  const vocabulary = Array.from(new Set(texts.flatMap((text) => text.toLowerCase().match(/[a-z]+/g) ?? [])))
  return {
    vectors: texts.map((text) => bagOfWords(text, vocabulary)),
    fallback: true,
    label: "bag-of-words (embedding model unavailable)",
  }
}

export async function lookupCounterparty(query: string): Promise<KvsResult> {
  const { vectors, fallback, label } = await embedAll([query, ...CORPUS.map((record) => record.profile)])
  const [queryVector, ...corpusVectors] = vectors

  const neighbors = CORPUS.map((record, index) => ({
    label: record.label,
    similarity: cosineSimilarity(queryVector, corpusVectors[index]),
    reliability: record.reliability,
  }))
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, 3)

  const weight = neighbors.reduce((sum, neighbor) => sum + Math.max(neighbor.similarity, 0.0001), 0)
  const score = neighbors.reduce((sum, n) => sum + n.reliability * Math.max(n.similarity, 0.0001), 0) / weight

  return {
    score: Math.round(score),
    neighbors,
    dimensions: queryVector.length,
    model: label,
    fallback,
  }
}
