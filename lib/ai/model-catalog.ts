export type ManifestEntry = {
  provider: "openai" | "anthropic"
  model_id: string
  name: string
  description: string
  parameters: Record<string, number>
}

const FRONTIER_PARAMS = { max_tokens: 16384 }
const SAMPLING_PARAMS = { max_tokens: 16384, temperature: 0.7 }

// Only providers whose model IDs have been verified through AIClient are managed by the sync and
// stale-model crons. Every other provider row in ai_models is left exactly as it is.
export const MANAGED_PROVIDERS = ["openai", "anthropic"] as const

export const MODEL_CAPABILITIES = ["text", "vision", "reasoning", "coding", "analysis", "long_context"]

// Only IDs that were called successfully through AIClient on 2026-11-19 belong here.
export const MODEL_MANIFEST: ManifestEntry[] = [
  { provider: "openai", model_id: "gpt-5.6-sol", name: "GPT-5.6 Sol", description: "OpenAI GPT-5.6 Sol", parameters: FRONTIER_PARAMS },
  { provider: "openai", model_id: "gpt-5.6-terra", name: "GPT-5.6 Terra", description: "OpenAI GPT-5.6 Terra", parameters: FRONTIER_PARAMS },
  { provider: "openai", model_id: "gpt-5.6-luna", name: "GPT-5.6 Luna", description: "OpenAI GPT-5.6 Luna", parameters: FRONTIER_PARAMS },
  { provider: "openai", model_id: "gpt-5.5", name: "GPT-5.5", description: "OpenAI GPT-5.5 flagship model", parameters: FRONTIER_PARAMS },
  { provider: "openai", model_id: "gpt-5.4", name: "GPT-5.4", description: "OpenAI GPT-5.4 flagship model", parameters: FRONTIER_PARAMS },
  { provider: "openai", model_id: "gpt-5.4-mini", name: "GPT-5.4 Mini", description: "OpenAI GPT-5.4 Mini, balanced speed and cost", parameters: { max_tokens: 8192 } },
  { provider: "openai", model_id: "gpt-5.4-nano", name: "GPT-5.4 Nano", description: "OpenAI GPT-5.4 Nano, lowest latency and cost", parameters: { max_tokens: 4096 } },
  { provider: "openai", model_id: "gpt-5.2", name: "GPT-5.2", description: "OpenAI GPT-5.2 flagship model", parameters: FRONTIER_PARAMS },
  { provider: "openai", model_id: "gpt-5.1", name: "GPT-5.1", description: "OpenAI GPT-5.1 flagship model", parameters: FRONTIER_PARAMS },
  { provider: "openai", model_id: "gpt-5", name: "GPT-5", description: "OpenAI GPT-5", parameters: FRONTIER_PARAMS },
  { provider: "openai", model_id: "gpt-5-mini", name: "GPT-5 Mini", description: "OpenAI GPT-5 Mini", parameters: { max_tokens: 8192 } },
  { provider: "openai", model_id: "gpt-5-nano", name: "GPT-5 Nano", description: "OpenAI GPT-5 Nano", parameters: { max_tokens: 4096 } },
  { provider: "openai", model_id: "o3", name: "OpenAI o3", description: "OpenAI o3 reasoning model", parameters: FRONTIER_PARAMS },
  { provider: "openai", model_id: "gpt-4.1", name: "GPT-4.1", description: "OpenAI GPT-4.1", parameters: SAMPLING_PARAMS },
  { provider: "openai", model_id: "gpt-4.1-mini", name: "GPT-4.1 Mini", description: "OpenAI GPT-4.1 Mini", parameters: SAMPLING_PARAMS },
  { provider: "openai", model_id: "gpt-4o", name: "GPT-4o", description: "OpenAI GPT-4o", parameters: SAMPLING_PARAMS },
  { provider: "anthropic", model_id: "claude-fable-5-2", name: "Claude Fable 5.2", description: "Claude Fable 5.2 with extended thinking for hard problems", parameters: FRONTIER_PARAMS },
  { provider: "anthropic", model_id: "claude-fable-5-1", name: "Claude Fable 5.1", description: "Claude Fable 5.1 with extended thinking for hard problems", parameters: FRONTIER_PARAMS },
  { provider: "anthropic", model_id: "claude-fable-5", name: "Claude Fable 5", description: "Claude Fable 5 with extended thinking for hard problems", parameters: FRONTIER_PARAMS },
  { provider: "anthropic", model_id: "claude-opus-5-5", name: "Claude Opus 5.5", description: "Claude Opus 5.5 for the most demanding reasoning and agentic tasks", parameters: FRONTIER_PARAMS },
  { provider: "anthropic", model_id: "claude-opus-5", name: "Claude Opus 5", description: "Claude Opus 5 for the most demanding reasoning and agentic tasks", parameters: FRONTIER_PARAMS },
  { provider: "anthropic", model_id: "claude-sonnet-5-5", name: "Claude Sonnet 5.5", description: "Claude Sonnet 5.5 for production workloads and complex reasoning", parameters: FRONTIER_PARAMS },
  { provider: "anthropic", model_id: "claude-sonnet-5", name: "Claude Sonnet 5", description: "Claude Sonnet 5 for production workloads and complex reasoning", parameters: FRONTIER_PARAMS },
  { provider: "anthropic", model_id: "claude-haiku-5-5", name: "Claude Haiku 5.5", description: "Claude Haiku 5.5 for fast, low-cost tasks", parameters: FRONTIER_PARAMS },
  { provider: "anthropic", model_id: "claude-opus-4-8", name: "Claude Opus 4.8", description: "Claude Opus 4.8 for deep reasoning and long-running agentic work", parameters: FRONTIER_PARAMS },
  { provider: "anthropic", model_id: "claude-opus-4-7", name: "Claude Opus 4.7", description: "Claude Opus 4.7 for deep reasoning and long-running agentic work", parameters: FRONTIER_PARAMS },
  { provider: "anthropic", model_id: "claude-opus-4-6", name: "Claude Opus 4.6", description: "Claude Opus 4.6 for deep reasoning and long-running agentic work", parameters: SAMPLING_PARAMS },
  { provider: "anthropic", model_id: "claude-sonnet-4-6", name: "Claude Sonnet 4.6", description: "Claude Sonnet 4.6 for production workloads and complex reasoning", parameters: SAMPLING_PARAMS },
  { provider: "anthropic", model_id: "claude-opus-4-5-20251101", name: "Claude Opus 4.5", description: "Claude Opus 4.5", parameters: { max_tokens: 32768, temperature: 0.7 } },
  { provider: "anthropic", model_id: "claude-haiku-4-5", name: "Claude Haiku 4.5", description: "Claude Haiku 4.5", parameters: { max_tokens: 8192, temperature: 0.7 } },
  { provider: "anthropic", model_id: "claude-sonnet-4-5", name: "Claude Sonnet 4.5", description: "Claude Sonnet 4.5", parameters: SAMPLING_PARAMS },
]
