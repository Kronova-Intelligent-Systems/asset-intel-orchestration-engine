/**
 * @kronova-intelligent-systems/sdk
 * Official TypeScript/JavaScript SDK for the Kronova Asset Intelligence Platform
 *
 * @version 2.0.0
 * @license MIT
 * @see https://docs.kronova.io
 */

// =============================================================================
// TYPES & INTERFACES
// =============================================================================

export interface KronovaConfig {
  apiKey: string
  baseUrl?: string
  timeout?: number
  retries?: number
  debug?: boolean
}

/** @deprecated Use KronovaConfig instead. */
export type ResenditConfig = KronovaConfig

export interface APIResponse<T> {
  success: boolean
  data: T
  error?: string
  meta?: {
    page?: number
    limit?: number
    total?: number
    hasMore?: boolean
  }
}

export interface PaginationParams {
  page?: number
  limit?: number
  offset?: number
  [key: string]: string | number | boolean | undefined
}

// Asset Types
export interface Asset {
  id: string
  name: string
  description?: string
  type: "equipment" | "vehicle" | "real_estate" | "inventory" | "other"
  status: "active" | "maintenance" | "retired" | "disposed"
  acquisition_date?: string
  acquisition_cost?: number
  current_value?: number
  location_id?: string
  metadata?: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface CreateAssetInput {
  name: string
  description?: string
  type: Asset["type"]
  status?: Asset["status"]
  acquisition_date?: string
  acquisition_cost?: number
  current_value?: number
  location_id?: string
  metadata?: Record<string, unknown>
}

export interface AssetInsights {
  asset_id: string
  insights: string
  recommendations: string[]
  risk_factors: string[]
  maintenance_predictions?: {
    next_maintenance_date?: string
    estimated_cost?: number
    priority: "low" | "medium" | "high" | "critical"
  }
  generated_at: string
}

// Embedding Types
export interface Embedding {
  id: string
  content: string
  embedding: number[]
  metadata?: Record<string, unknown>
  file_id?: string
  dataset_id?: string
  created_at: string
}

export interface CreateEmbeddingInput {
  content: string
  metadata?: Record<string, unknown>
  dataset_id?: string
}

export interface EmbeddingSearchResult {
  id: string
  content: string
  similarity: number
  metadata?: Record<string, unknown>
}

export interface Dataset {
  id: string
  name: string
  description?: string
  embedding_count: number
  created_at: string
  updated_at: string
}

// Tokenization Types
export interface TokenizedAsset {
  id: string
  asset_id: string
  token_id: string
  blockchain: "sui" | "canton" | "ethereum"
  contract_address?: string
  total_supply: number
  fractionalized: boolean
  fraction_count?: number
  metadata_uri?: string
  status: "pending" | "minted" | "burned"
  created_at: string
}

export interface TokenizeAssetInput {
  asset_id: string
  blockchain?: "sui" | "canton" | "ethereum"
  total_supply?: number
  metadata?: Record<string, unknown>
}

export interface FractionalizeInput {
  token_id: string
  fraction_count: number
  fraction_price?: number
}

// Stablecoin Types
export interface Stablecoin {
  id: string
  name: string
  symbol: string
  decimals: number
  total_supply: string
  backing_type: "usdc" | "multi_collateral" | "algorithmic"
  backing_ratio: number
  status: "active" | "paused" | "deprecated"
  contract_address?: string
  created_at: string
}

export interface CreateStablecoinInput {
  name: string
  symbol: string
  decimals?: number
  backing_type: Stablecoin["backing_type"]
  initial_supply?: string
  compliance_config?: {
    kyc_required: boolean
    whitelist_only: boolean
    max_supply?: string
  }
}

export interface MintStablecoinInput {
  amount: string
  recipient_address: string
  backing_transaction_id?: string
}

export interface BurnStablecoinInput {
  amount: string
  redemption_address?: string
}

export interface TransferStablecoinInput {
  amount: string
  from_address: string
  to_address: string
  memo?: string
}

// Agent Types
export interface Agent {
  id: string
  name: string
  description?: string
  model_id: string
  system_prompt?: string
  temperature: number
  max_tokens: number
  tools: string[]
  status: "active" | "inactive"
  created_at: string
}

export interface ExecuteAgentInput {
  prompt: string
  context?: Record<string, unknown>
  asset_ids?: string[]
  stream?: boolean
}

export interface AgentExecutionResult {
  id: string
  agent_id: string
  prompt: string
  response: string
  tokens_used: number
  execution_time_ms: number
  created_at: string
}

// Workflow Types
export interface Workflow {
  id: string
  name: string
  description?: string
  steps: WorkflowStep[]
  status: "active" | "inactive"
  created_at: string
}

export interface WorkflowStep {
  id: string
  type: "agent" | "condition" | "action" | "delay"
  config: Record<string, unknown>
  next_step_id?: string
}

export interface ExecuteWorkflowInput {
  input_data?: Record<string, unknown>
  asset_ids?: string[]
}

export interface WorkflowExecutionResult {
  id: string
  workflow_id: string
  status: "pending" | "running" | "completed" | "failed"
  results: Record<string, unknown>
  started_at: string
  completed_at?: string
}

// Data Stream Types
export interface DataStreamConfig {
  stream_type: "agents" | "workflows" | "iot-sensors" | "assets"
  filters?: Record<string, unknown>
}

// OAuth Types
export interface OAuthClient {
  client_id: string
  client_name: string
  redirect_uris: string[]
  scopes: string[]
  created_at: string
}

export interface OAuthTokenResponse {
  access_token: string
  token_type: "Bearer"
  expires_in: number
  refresh_token?: string
  scope: string
}

// A2A Protocol Types (Agent2Agent Interoperability) - served at /api/a2a
export const A2A_PROTOCOL_VERSION = "1.0"

export type A2ATaskState = "submitted" | "working" | "input-required" | "completed" | "failed" | "canceled" | "rejected"

export type A2APart =
  | { type: "text"; text: string; metadata?: Record<string, unknown> }
  | {
      type: "file"
      file: { name?: string; mimeType: string; bytes?: string; uri?: string }
      metadata?: Record<string, unknown>
    }
  | { type: "data"; data: Record<string, unknown>; metadata?: Record<string, unknown> }

export interface A2AMessage {
  messageId: string
  role: "user" | "agent"
  parts: A2APart[]
  contextId?: string
  referenceTaskIds?: string[]
  metadata?: Record<string, unknown>
}

export interface A2ATaskStatus {
  state: A2ATaskState
  timestamp?: string
  message?: A2AMessage
}

export interface A2AArtifact {
  artifactId: string
  name?: string
  description?: string
  parts: A2APart[]
  metadata?: Record<string, unknown>
}

export interface A2ATask {
  id: string
  contextId: string
  status: A2ATaskStatus
  history?: A2AMessage[]
  artifacts?: A2AArtifact[]
  metadata?: Record<string, unknown>
}

export interface A2AAgentCard {
  agentId: string
  name: string
  description?: string
  url: string
  protocolVersions: string[]
  capabilities: {
    streaming?: boolean
    pushNotifications?: boolean
    extendedAgentCard?: boolean
    stateTransitionHistory?: boolean
  }
  skills?: Array<{
    id: string
    name: string
    description?: string
    inputModes?: string[]
    outputModes?: string[]
    tags?: string[]
    examples?: string[]
  }>
  defaultInputModes?: string[]
  defaultOutputModes?: string[]
  provider?: { organization?: string; url?: string }
  documentationUrl?: string
}

export interface A2ASendMessageInput {
  message: A2AMessage
  configuration?: {
    acceptedOutputModes?: string[]
    historyLength?: number
    blocking?: boolean
  }
  metadata?: Record<string, unknown>
}

export interface A2AListTasksInput {
  contextId?: string
  status?: A2ATaskState
  pageSize?: number
  pageToken?: string
  historyLength?: number
  includeArtifacts?: boolean
}

export interface A2AListTasksResponse {
  tasks: A2ATask[]
  nextPageToken: string
  pageSize: number
  totalSize: number
}

// =============================================================================
// SDK IMPLEMENTATION
// =============================================================================

export class KronovaSDKBase {
  private config: Required<KronovaConfig>

  // Sub-clients
  public assets: AssetsClient
  public embeddings: EmbeddingsClient
  public datasets: DatasetsClient
  public tokenization: TokenizationClient
  public stablecoins: StablecoinsClient
  public agents: AgentsClient
  public workflows: WorkflowsClient
  public dataStreams: DataStreamsClient
  public oauth: OAuthClient_SDK
  public a2a: A2AClient

  constructor(config: KronovaConfig) {
    this.config = {
      apiKey: config.apiKey,
      baseUrl: config.baseUrl || "https://app.kronova.io/api/v1",
      timeout: config.timeout || 30000,
      retries: config.retries || 3,
      debug: config.debug || false,
    }

    // Initialize sub-clients
    this.assets = new AssetsClient(this)
    this.embeddings = new EmbeddingsClient(this)
    this.datasets = new DatasetsClient(this)
    this.tokenization = new TokenizationClient(this)
    this.stablecoins = new StablecoinsClient(this)
    this.agents = new AgentsClient(this)
    this.workflows = new WorkflowsClient(this)
    this.dataStreams = new DataStreamsClient(this)
    this.oauth = new OAuthClient_SDK(this)
    this.a2a = new A2AClient(this)
  }

  /**
   * Make an authenticated API request
   */
  async request<T>(
    method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE",
    path: string,
    options: {
      body?: unknown
      params?: Record<string, string | number | boolean | undefined>
      headers?: Record<string, string>
      baseUrl?: string
    } = {},
  ): Promise<APIResponse<T>> {
    const url = new URL(`${options.baseUrl ?? this.config.baseUrl}${path}`)

    // Add query parameters
    if (options.params) {
      Object.entries(options.params).forEach(([key, value]) => {
        if (value !== undefined) {
          url.searchParams.append(key, String(value))
        }
      })
    }

    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.config.apiKey}`,
      "Content-Type": "application/json",
      "X-SDK-Version": "2.0.0",
      ...options.headers,
    }

    let lastError: Error | null = null

    for (let attempt = 0; attempt < this.config.retries; attempt++) {
      try {
        if (this.config.debug) {
          console.log(`[KronovaSDK] ${method} ${url.toString()}`)
        }

        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), this.config.timeout)

        const response = await fetch(url.toString(), {
          method,
          headers,
          body: options.body ? JSON.stringify(options.body) : undefined,
          signal: controller.signal,
        })

        clearTimeout(timeoutId)

        const data = await response.json()

        if (!response.ok) {
          throw new KronovaAPIError(data.error || `HTTP ${response.status}`, response.status, data)
        }

        return data as APIResponse<T>
      } catch (error) {
        lastError = error as Error

        // Don't retry on client errors (4xx)
        if (error instanceof KronovaAPIError && error.status >= 400 && error.status < 500) {
          throw error
        }

        // Wait before retry with exponential backoff
        if (attempt < this.config.retries - 1) {
          await new Promise((resolve) => setTimeout(resolve, Math.pow(2, attempt) * 1000))
        }
      }
    }

    throw lastError || new Error("Request failed after retries")
  }

  /**
   * Get SDK configuration
   */
  getConfig(): Readonly<Required<KronovaConfig>> {
    return { ...this.config }
  }
}

// =============================================================================
// ERROR CLASSES
// =============================================================================

export class KronovaAPIError extends Error {
  public status: number
  public response: unknown

  constructor(message: string, status: number, response?: unknown) {
    super(message)
    this.name = "KronovaAPIError"
    this.status = status
    this.response = response
  }
}

// Legacy error class for backward compatibility
export class ResenditAPIError extends KronovaAPIError {
  constructor(message: string, status: number, response?: unknown) {
    super(message, status, response)
    this.name = "ResenditAPIError"
  }
}

// =============================================================================
// SUB-CLIENTS
// =============================================================================

class AssetsClient {
  constructor(private sdk: KronovaSDKBase) {}

  async list(params?: PaginationParams): Promise<APIResponse<Asset[]>> {
    return this.sdk.request("GET", "/assets", { params })
  }

  async get(id: string): Promise<APIResponse<Asset>> {
    return this.sdk.request("GET", `/assets/${id}`)
  }

  async create(input: CreateAssetInput): Promise<APIResponse<Asset>> {
    return this.sdk.request("POST", "/assets", { body: input })
  }

  async update(id: string, input: Partial<CreateAssetInput>): Promise<APIResponse<Asset>> {
    return this.sdk.request("PATCH", `/assets/${id}`, { body: input })
  }

  async delete(id: string): Promise<APIResponse<{ deleted: boolean }>> {
    return this.sdk.request("DELETE", `/assets/${id}`)
  }

  async generateInsights(id: string): Promise<APIResponse<AssetInsights>> {
    return this.sdk.request("POST", `/assets/${id}/insights`)
  }
}

class EmbeddingsClient {
  constructor(private sdk: KronovaSDKBase) {}

  async list(params?: PaginationParams & { dataset_id?: string }): Promise<APIResponse<Embedding[]>> {
    return this.sdk.request("GET", "/embeddings", { params })
  }

  async get(id: string): Promise<APIResponse<Embedding>> {
    return this.sdk.request("GET", `/embeddings/${id}`)
  }

  async create(input: CreateEmbeddingInput): Promise<APIResponse<Embedding>> {
    return this.sdk.request("POST", "/embeddings", { body: input })
  }

  async createBatch(inputs: CreateEmbeddingInput[]): Promise<APIResponse<Embedding[]>> {
    return this.sdk.request("POST", "/embeddings", { body: { embeddings: inputs } })
  }

  async delete(id: string): Promise<APIResponse<{ deleted: boolean }>> {
    return this.sdk.request("DELETE", `/embeddings/${id}`)
  }

  async search(
    query: string,
    options?: {
      dataset_id?: string
      limit?: number
      threshold?: number
    },
  ): Promise<APIResponse<EmbeddingSearchResult[]>> {
    return this.sdk.request("POST", "/embeddings/search", {
      body: { query, ...options },
    })
  }
}

class DatasetsClient {
  constructor(private sdk: KronovaSDKBase) {}

  async list(params?: PaginationParams): Promise<APIResponse<Dataset[]>> {
    return this.sdk.request("GET", "/datasets", { params })
  }

  async get(id: string): Promise<APIResponse<Dataset>> {
    return this.sdk.request("GET", `/datasets/${id}`)
  }

  async create(input: { name: string; description?: string }): Promise<APIResponse<Dataset>> {
    return this.sdk.request("POST", "/datasets", { body: input })
  }

  async delete(id: string): Promise<APIResponse<{ deleted: boolean }>> {
    return this.sdk.request("DELETE", `/datasets/${id}`)
  }
}

class TokenizationClient {
  constructor(private sdk: KronovaSDKBase) {}

  async list(params?: PaginationParams): Promise<APIResponse<TokenizedAsset[]>> {
    return this.sdk.request("GET", "/tokenization", { params })
  }

  async get(id: string): Promise<APIResponse<TokenizedAsset>> {
    return this.sdk.request("GET", `/tokenization/${id}`)
  }

  async tokenize(input: TokenizeAssetInput): Promise<APIResponse<TokenizedAsset>> {
    return this.sdk.request("POST", "/tokenization", { body: input })
  }

  async fractionalize(input: FractionalizeInput): Promise<APIResponse<TokenizedAsset>> {
    return this.sdk.request("POST", "/tokenization/fractionalize", { body: input })
  }

  async burn(id: string): Promise<APIResponse<{ burned: boolean }>> {
    return this.sdk.request("DELETE", `/tokenization/${id}`)
  }
}

class StablecoinsClient {
  constructor(private sdk: KronovaSDKBase) {}

  async list(params?: PaginationParams): Promise<APIResponse<Stablecoin[]>> {
    return this.sdk.request("GET", "/stablecoins", { params })
  }

  async get(id: string): Promise<APIResponse<Stablecoin>> {
    return this.sdk.request("GET", `/stablecoins/${id}`)
  }

  async create(input: CreateStablecoinInput): Promise<APIResponse<Stablecoin>> {
    return this.sdk.request("POST", "/stablecoins", { body: input })
  }

  async mint(
    id: string,
    input: MintStablecoinInput,
  ): Promise<APIResponse<{ transaction_id: string; new_supply: string }>> {
    return this.sdk.request("POST", `/stablecoins/${id}/mint`, { body: input })
  }

  async burn(
    id: string,
    input: BurnStablecoinInput,
  ): Promise<APIResponse<{ transaction_id: string; new_supply: string }>> {
    return this.sdk.request("POST", `/stablecoins/${id}/burn`, { body: input })
  }

  async transfer(id: string, input: TransferStablecoinInput): Promise<APIResponse<{ transaction_id: string }>> {
    return this.sdk.request("POST", `/stablecoins/${id}/transfer`, { body: input })
  }
}

class AgentsClient {
  constructor(private sdk: KronovaSDKBase) {}

  async list(params?: PaginationParams): Promise<APIResponse<Agent[]>> {
    return this.sdk.request("GET", "/agents", { params })
  }

  async get(id: string): Promise<APIResponse<Agent>> {
    return this.sdk.request("GET", `/agents/${id}`)
  }

  async execute(id: string, input: ExecuteAgentInput): Promise<APIResponse<AgentExecutionResult>> {
    return this.sdk.request("POST", `/agents/${id}/execute`, { body: input })
  }

  async *executeStream(id: string, input: ExecuteAgentInput): AsyncGenerator<string, void, unknown> {
    const config = this.sdk.getConfig()
    const url = `${config.baseUrl}/agents/${id}/execute`

    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
        Accept: "text/event-stream",
      },
      body: JSON.stringify({ ...input, stream: true }),
    })

    if (!response.ok) {
      throw new KronovaAPIError(`HTTP ${response.status}`, response.status)
    }

    const reader = response.body?.getReader()
    if (!reader) {
      throw new Error("No response body")
    }

    const decoder = new TextDecoder()
    let buffer = ""

    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split("\n")
        buffer = lines.pop() || ""

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6)
            if (data === "[DONE]") return
            yield data
          }
        }
      }
    } finally {
      reader.releaseLock()
    }
  }
}

class WorkflowsClient {
  constructor(private sdk: KronovaSDKBase) {}

  async list(params?: PaginationParams): Promise<APIResponse<Workflow[]>> {
    return this.sdk.request("GET", "/workflows", { params })
  }

  async get(id: string): Promise<APIResponse<Workflow>> {
    return this.sdk.request("GET", `/workflows/${id}`)
  }

  async execute(id: string, input: ExecuteWorkflowInput): Promise<APIResponse<WorkflowExecutionResult>> {
    return this.sdk.request("POST", `/workflows/${id}/execute`, { body: input })
  }
}

class DataStreamsClient {
  constructor(private sdk: KronovaSDKBase) {}

  /**
   * Subscribe to real-time data streams using Server-Sent Events
   */
  subscribe(
    config: DataStreamConfig,
    callbacks: {
      onMessage: (data: unknown) => void
      onError?: (error: Error) => void
      onClose?: () => void
    },
  ): { close: () => void } {
    const sdkConfig = this.sdk.getConfig()
    const url = new URL(`${sdkConfig.baseUrl}/data-streams/${config.stream_type}`)
    url.searchParams.set("format", "sse")

    if (config.filters) {
      url.searchParams.set("filters", JSON.stringify(config.filters))
    }

    const eventSource = new EventSource(url.toString(), {
      // Note: EventSource doesn't support custom headers in browsers
      // For authenticated streams, use the polling method or WebSocket
    })

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        callbacks.onMessage(data)
      } catch {
        callbacks.onMessage(event.data)
      }
    }

    eventSource.onerror = () => {
      callbacks.onError?.(new Error("EventSource connection error"))
    }

    return {
      close: () => {
        eventSource.close()
        callbacks.onClose?.()
      },
    }
  }

  /**
   * Poll for data stream updates (for environments that don't support SSE)
   */
  async poll(config: DataStreamConfig): Promise<APIResponse<unknown[]>> {
    return this.sdk.request("GET", `/data-streams/${config.stream_type}`, {
      params: {
        format: "json",
        filters: config.filters ? JSON.stringify(config.filters) : undefined,
      },
    })
  }
}

class OAuthClient_SDK {
  constructor(private sdk: KronovaSDKBase) {}

  async listClients(): Promise<APIResponse<OAuthClient[]>> {
    return this.sdk.request("GET", "/oauth/clients")
  }

  async createClient(input: {
    client_name: string
    redirect_uris: string[]
    scopes: string[]
  }): Promise<APIResponse<OAuthClient & { client_secret: string }>> {
    return this.sdk.request("POST", "/oauth/clients", { body: input })
  }

  /**
   * Generate authorization URL for OAuth 2.1 flow
   */
  getAuthorizationUrl(params: {
    client_id: string
    redirect_uri: string
    scope: string
    state: string
    code_challenge: string
    code_challenge_method?: "S256"
  }): string {
    const config = this.sdk.getConfig()
    const baseUrl = config.baseUrl.replace("/api/v1", "")
    const url = new URL(`${baseUrl}/api/v1/oauth/authorize`)

    url.searchParams.set("response_type", "code")
    url.searchParams.set("client_id", params.client_id)
    url.searchParams.set("redirect_uri", params.redirect_uri)
    url.searchParams.set("scope", params.scope)
    url.searchParams.set("state", params.state)
    url.searchParams.set("code_challenge", params.code_challenge)
    url.searchParams.set("code_challenge_method", params.code_challenge_method || "S256")

    return url.toString()
  }

  /**
   * Exchange authorization code for tokens
   */
  async exchangeCode(params: {
    code: string
    client_id: string
    client_secret: string
    redirect_uri: string
    code_verifier: string
  }): Promise<APIResponse<OAuthTokenResponse>> {
    return this.sdk.request("POST", "/oauth/token", {
      body: {
        grant_type: "authorization_code",
        ...params,
      },
    })
  }

  /**
   * Refresh access token
   */
  async refreshToken(params: {
    refresh_token: string
    client_id: string
    client_secret: string
  }): Promise<APIResponse<OAuthTokenResponse>> {
    return this.sdk.request("POST", "/oauth/token", {
      body: {
        grant_type: "refresh_token",
        ...params,
      },
    })
  }
}

class A2AClient {
  constructor(private sdk: KronovaSDKBase) {}

  /**
   * The A2A endpoint lives at /api/a2a on the app origin, outside the versioned /api/v1 surface.
   */
  private call<T>(
    method: "GET" | "POST",
    options: { params?: Record<string, string | number | boolean | undefined>; body?: unknown } = {},
  ): Promise<T> {
    const baseUrl = `${new URL(this.sdk.getConfig().baseUrl).origin}/api/a2a`
    return this.sdk.request<unknown>(method, "", {
      ...options,
      baseUrl,
      headers: { "A2A-Version": A2A_PROTOCOL_VERSION },
    }) as unknown as Promise<T>
  }

  /** List public Agent Cards. Does not require authentication. */
  async discover(): Promise<{ agents: A2AAgentCard[]; protocolVersion: string }> {
    return this.call("GET", { params: { action: "discover" } })
  }

  /** List Agent Cards owned by the API key's user (raw database rows). Requires `read:agents`. */
  async listAgentCards(): Promise<{ cards: Record<string, unknown>[] }> {
    return this.call("GET", { params: { action: "list-cards" } })
  }

  async getAgentCard(agentId: string): Promise<A2AAgentCard> {
    return this.call("GET", { params: { agentId } })
  }

  /** Requires `write:agents`. The server assigns the `agentId`. */
  async createAgentCard(card: Omit<A2AAgentCard, "agentId">): Promise<A2AAgentCard> {
    return this.call("POST", { body: { action: "agentCard/create", card } })
  }

  async sendMessage(input: A2ASendMessageInput): Promise<A2ATask | A2AMessage> {
    return this.call("POST", { body: { action: "message/send", ...input } })
  }

  async getTask(taskId: string, historyLength?: number): Promise<A2ATask> {
    return this.call("GET", { params: { taskId, historyLength } })
  }

  async listTasks(params: A2AListTasksInput = {}): Promise<A2AListTasksResponse> {
    return this.call("GET", { params: { action: "list-tasks", ...params } })
  }

  async cancelTask(taskId: string): Promise<A2ATask> {
    return this.call("POST", { body: { action: "tasks/cancel", taskId } })
  }

  async updateTaskStatus(taskId: string, status: A2ATaskStatus): Promise<A2ATask> {
    return this.call("POST", { body: { action: "tasks/updateStatus", taskId, status } })
  }

  async addArtifact(taskId: string, artifact: A2AArtifact): Promise<A2AArtifact> {
    return this.call("POST", { body: { action: "tasks/addArtifact", taskId, artifact } })
  }

  async sendViaAetherNet(targetAddress: string, request: A2ASendMessageInput): Promise<unknown> {
    return this.call("POST", { body: { action: "aethernet/send", targetAddress, request } })
  }
}

// =============================================================================
// KAIRO SUPPORT CLIENT
// =============================================================================

export interface KairoMessage {
  role: "user" | "assistant"
  content: string
}

export interface KairoSendResult {
  success: boolean
  reply?: string
  conversationId?: string
  error?: string
}

export interface KairoTranscribeResult {
  success: boolean
  text?: string
  error?: string
}

/**
 * A single Server-Sent-Events chunk emitted by /support/message/stream.
 * "delta" chunks carry incremental text; "done" carries final metadata
 * once the platform has finished RAG retrieval, generation, and persistence.
 */
export type KairoStreamChunk =
  | { type: "delta"; text: string }
  | { type: "done"; conversationId?: string }
  | { type: "error"; error: string }

/**
 * KairoSupportClient — lightweight client for the Kairo chatbot API.
 *
 * Designed for use in external projects (e.g. kronova.io) that call
 * the Kronova platform API rather than running server actions directly.
 * Wraps /v1/support/message and /v1/support/transcribe endpoints.
 */
class KairoSupportClient {
  constructor(private sdk: KronovaSDKBase) {}

  /**
   * Send a message to Kairo and receive an AI-generated reply.
   * The platform handles RAG retrieval, persistence, and model routing.
   */
  async send(
    messages: KairoMessage[],
    options?: {
      conversationId?: string
      modelId?: string
      inputMode?: "text" | "voice"
    },
  ): Promise<APIResponse<KairoSendResult>> {
    return this.sdk.request("POST", "/support/message", {
      body: {
        messages,
        conversation_id: options?.conversationId,
        model_id: options?.modelId ?? "openai/gpt-4o",
        input_mode: options?.inputMode ?? "text",
      },
    })
  }

  /**
   * Send a message to Kairo and stream the reply as it's generated.
   * The platform still handles RAG retrieval, persistence, and model
   * routing server-side — only the response delivery is incremental.
   *
   * Consume with `for await (const chunk of sdk.support.sendStream(...))`.
   * Requires the platform's /support/message/stream endpoint (SSE).
   */
  async *sendStream(
    messages: KairoMessage[],
    options?: {
      conversationId?: string
      modelId?: string
      inputMode?: "text" | "voice"
      signal?: AbortSignal
    },
  ): AsyncGenerator<KairoStreamChunk, void, unknown> {
    const config = this.sdk.getConfig()
    const response = await fetch(`${config.baseUrl}/support/message/stream`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
        Accept: "text/event-stream",
      },
      body: JSON.stringify({
        messages,
        conversation_id: options?.conversationId,
        model_id: options?.modelId ?? "openai/gpt-4o",
        input_mode: options?.inputMode ?? "text",
        stream: true,
      }),
      signal: options?.signal,
    })

    if (!response.ok || !response.body) {
      throw new KronovaAPIError(`HTTP ${response.status}`, response.status)
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ""

    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split("\n")
        buffer = lines.pop() ?? ""

        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed.startsWith("data:")) continue

          const payload = trimmed.slice(5).trim()
          if (payload === "[DONE]") return

          try {
            yield JSON.parse(payload) as KairoStreamChunk
          } catch {
            // Skip malformed SSE frames rather than aborting the whole stream.
          }
        }
      }
    } finally {
      reader.releaseLock()
    }
  }

  /**
   * Transcribe an audio ArrayBuffer via the platform's voice pipeline.
   * Returns the transcribed text ready to pass to send().
   */
  async transcribe(audioBuffer: ArrayBuffer): Promise<APIResponse<KairoTranscribeResult>> {
    const config = this.sdk.getConfig()
    const url = `${config.baseUrl}/support/transcribe`

    const blob = new Blob([audioBuffer], { type: "audio/wav" })
    const formData = new FormData()
    formData.append("audio", blob, "audio.wav")

    const response = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${config.apiKey}` },
      body: formData,
    })

    if (!response.ok) {
      throw new KronovaAPIError(`HTTP ${response.status}`, response.status)
    }

    return response.json()
  }

  /**
   * Close a support conversation — stamps ended_at on the session row.
   */
  async closeConversation(conversationId: string): Promise<APIResponse<{ closed: boolean }>> {
    return this.sdk.request("POST", `/support/conversations/${conversationId}/close`)
  }
}

// =============================================================================
// FACTORY FUNCTION
// =============================================================================

/**
 * Kronova SDK - Primary branded SDK class
 */
export class KronovaSDK extends KronovaSDKBase {
  public support: KairoSupportClient

  constructor(config: KronovaConfig) {
    super(config)
    this.support = new KairoSupportClient(this)
  }
}

/** @deprecated Use KronovaSDK instead. Retained for backward compatibility. */
export const ResenditSDK = KronovaSDK

/**
 * Create a new Kronova SDK instance
 */
export function createKronovaClient(config: KronovaConfig): KronovaSDK {
  return new KronovaSDK(config)
}

/**
 * @deprecated Use createKronovaClient instead.
 */
export function createResenditClient(config: KronovaConfig): KronovaSDK {
  return new KronovaSDK(config)
}

// Default export
export default KronovaSDK
