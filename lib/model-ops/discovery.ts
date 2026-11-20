import type { ManagedProvider, ProviderListing } from "./types"

export interface DiscoveredModel {
  id: string
  displayName?: string
  createdAt?: number
}

const RECENT_MS = 180 * 24 * 60 * 60 * 1000
const OPENAI_EXCLUDE =
  /(audio|realtime|transcribe|tts|whisper|image|embedding|moderation|search|codex|instruct|davinci|babbage|computer-use|diarize|sora|\d{4}-\d{2}-\d{2}|-\d{4}$)/i

export function isChatCandidate(provider: ManagedProvider, id: string): boolean {
  if (provider === "openai") return /^(gpt-|o\d|chatgpt-)/i.test(id) && !OPENAI_EXCLUDE.test(id)
  return /^claude-/i.test(id)
}

export function isRecent(model: DiscoveredModel, now = Date.now()): boolean {
  return model.createdAt !== undefined && now - model.createdAt <= RECENT_MS
}

async function getJson(url: string, headers: Record<string, string>): Promise<unknown> {
  const response = await fetch(url, { headers, signal: AbortSignal.timeout(20_000), cache: "no-store" })
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  return response.json()
}

async function listOpenAi(): Promise<DiscoveredModel[]> {
  const key = process.env.OPENAI_API_KEY
  if (!key) throw new Error("OPENAI_API_KEY is not set")
  const body = (await getJson("https://api.openai.com/v1/models", { Authorization: `Bearer ${key}` })) as {
    data?: Array<{ id: string; created?: number }>
  }
  return (body.data ?? []).map((m) => ({ id: m.id, createdAt: m.created ? m.created * 1000 : undefined }))
}

async function listAnthropic(): Promise<DiscoveredModel[]> {
  const key = process.env.ANTHROPIC_API_KEY
  if (!key) throw new Error("ANTHROPIC_API_KEY is not set")
  const body = (await getJson("https://api.anthropic.com/v1/models?limit=1000", {
    "x-api-key": key,
    "anthropic-version": "2023-06-01",
  })) as { data?: Array<{ id: string; display_name?: string; created_at?: string }> }
  return (body.data ?? []).map((m) => ({
    id: m.id,
    displayName: m.display_name,
    createdAt: m.created_at ? Date.parse(m.created_at) : undefined,
  }))
}

export async function listProviderModels(): Promise<{
  byProvider: Record<ManagedProvider, DiscoveredModel[]>
  listings: ProviderListing[]
}> {
  const byProvider: Record<ManagedProvider, DiscoveredModel[]> = { openai: [], anthropic: [] }
  const listings: ProviderListing[] = []
  const sources: Array<[ManagedProvider, () => Promise<DiscoveredModel[]>]> = [
    ["openai", listOpenAi],
    ["anthropic", listAnthropic],
  ]
  for (const [provider, list] of sources) {
    try {
      const models = await list()
      byProvider[provider] = models
      listings.push({ provider, listed: models.length, ok: models.length > 0 })
    } catch (error) {
      listings.push({ provider, listed: 0, ok: false, error: error instanceof Error ? error.message : "listing failed" })
    }
  }
  return { byProvider, listings }
}
