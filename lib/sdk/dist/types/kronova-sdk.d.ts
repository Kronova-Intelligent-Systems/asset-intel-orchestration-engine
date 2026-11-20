/**
 * @kronova-intelligent-systems/sdk
 * Official TypeScript/JavaScript SDK for the Kronova Asset Intelligence Platform
 *
 * @version 2.0.0
 * @license MIT
 * @see https://docs.kronova.io
 */
export interface KronovaConfig {
    apiKey: string;
    baseUrl?: string;
    timeout?: number;
    retries?: number;
    debug?: boolean;
}
/** @deprecated Use KronovaConfig instead. */
export type ResenditConfig = KronovaConfig;
export interface APIResponse<T> {
    success: boolean;
    data: T;
    error?: string;
    meta?: {
        page?: number;
        limit?: number;
        total?: number;
        hasMore?: boolean;
    };
}
export interface PaginationParams {
    page?: number;
    limit?: number;
    offset?: number;
    [key: string]: string | number | boolean | undefined;
}
export interface Asset {
    id: string;
    name: string;
    description?: string;
    type: "equipment" | "vehicle" | "real_estate" | "inventory" | "other";
    status: "active" | "maintenance" | "retired" | "disposed";
    acquisition_date?: string;
    acquisition_cost?: number;
    current_value?: number;
    location_id?: string;
    metadata?: Record<string, unknown>;
    created_at: string;
    updated_at: string;
}
export interface CreateAssetInput {
    name: string;
    description?: string;
    type: Asset["type"];
    status?: Asset["status"];
    acquisition_date?: string;
    acquisition_cost?: number;
    current_value?: number;
    location_id?: string;
    metadata?: Record<string, unknown>;
}
export interface AssetInsights {
    asset_id: string;
    insights: string;
    recommendations: string[];
    risk_factors: string[];
    maintenance_predictions?: {
        next_maintenance_date?: string;
        estimated_cost?: number;
        priority: "low" | "medium" | "high" | "critical";
    };
    generated_at: string;
}
export interface Embedding {
    id: string;
    content: string;
    embedding: number[];
    metadata?: Record<string, unknown>;
    file_id?: string;
    dataset_id?: string;
    created_at: string;
}
export interface CreateEmbeddingInput {
    content: string;
    metadata?: Record<string, unknown>;
    dataset_id?: string;
}
export interface EmbeddingSearchResult {
    id: string;
    content: string;
    similarity: number;
    metadata?: Record<string, unknown>;
}
export interface Dataset {
    id: string;
    name: string;
    description?: string;
    embedding_count: number;
    created_at: string;
    updated_at: string;
}
export interface TokenizedAsset {
    id: string;
    asset_id: string;
    token_id: string;
    blockchain: "sui" | "canton" | "ethereum";
    contract_address?: string;
    total_supply: number;
    fractionalized: boolean;
    fraction_count?: number;
    metadata_uri?: string;
    status: "pending" | "minted" | "burned";
    created_at: string;
}
export interface TokenizeAssetInput {
    asset_id: string;
    blockchain?: "sui" | "canton" | "ethereum";
    total_supply?: number;
    metadata?: Record<string, unknown>;
}
export interface FractionalizeInput {
    token_id: string;
    fraction_count: number;
    fraction_price?: number;
}
export interface Stablecoin {
    id: string;
    name: string;
    symbol: string;
    decimals: number;
    total_supply: string;
    backing_type: "usdc" | "multi_collateral" | "algorithmic";
    backing_ratio: number;
    status: "active" | "paused" | "deprecated";
    contract_address?: string;
    created_at: string;
}
export interface CreateStablecoinInput {
    name: string;
    symbol: string;
    decimals?: number;
    backing_type: Stablecoin["backing_type"];
    initial_supply?: string;
    compliance_config?: {
        kyc_required: boolean;
        whitelist_only: boolean;
        max_supply?: string;
    };
}
export interface MintStablecoinInput {
    amount: string;
    recipient_address: string;
    backing_transaction_id?: string;
}
export interface BurnStablecoinInput {
    amount: string;
    redemption_address?: string;
}
export interface TransferStablecoinInput {
    amount: string;
    from_address: string;
    to_address: string;
    memo?: string;
}
export interface Agent {
    id: string;
    name: string;
    description?: string;
    model_id: string;
    system_prompt?: string;
    temperature: number;
    max_tokens: number;
    tools: string[];
    status: "active" | "inactive";
    created_at: string;
}
export interface ExecuteAgentInput {
    prompt: string;
    context?: Record<string, unknown>;
    asset_ids?: string[];
    stream?: boolean;
}
export interface AgentExecutionResult {
    id: string;
    agent_id: string;
    prompt: string;
    response: string;
    tokens_used: number;
    execution_time_ms: number;
    created_at: string;
}
export interface Workflow {
    id: string;
    name: string;
    description?: string;
    steps: WorkflowStep[];
    status: "active" | "inactive";
    created_at: string;
}
export interface WorkflowStep {
    id: string;
    type: "agent" | "condition" | "action" | "delay";
    config: Record<string, unknown>;
    next_step_id?: string;
}
export interface ExecuteWorkflowInput {
    input_data?: Record<string, unknown>;
    asset_ids?: string[];
}
export interface WorkflowExecutionResult {
    id: string;
    workflow_id: string;
    status: "pending" | "running" | "completed" | "failed";
    results: Record<string, unknown>;
    started_at: string;
    completed_at?: string;
}
export interface DataStreamConfig {
    stream_type: "agents" | "workflows" | "iot-sensors" | "assets";
    filters?: Record<string, unknown>;
}
export interface OAuthClient {
    client_id: string;
    client_name: string;
    redirect_uris: string[];
    scopes: string[];
    created_at: string;
}
export interface OAuthTokenResponse {
    access_token: string;
    token_type: "Bearer";
    expires_in: number;
    refresh_token?: string;
    scope: string;
}
export declare const A2A_PROTOCOL_VERSION = "1.0";
export type A2ATaskState = "submitted" | "working" | "input-required" | "completed" | "failed" | "canceled" | "rejected";
export type A2APart = {
    type: "text";
    text: string;
    metadata?: Record<string, unknown>;
} | {
    type: "file";
    file: {
        name?: string;
        mimeType: string;
        bytes?: string;
        uri?: string;
    };
    metadata?: Record<string, unknown>;
} | {
    type: "data";
    data: Record<string, unknown>;
    metadata?: Record<string, unknown>;
};
export interface A2AMessage {
    messageId: string;
    role: "user" | "agent";
    parts: A2APart[];
    contextId?: string;
    referenceTaskIds?: string[];
    metadata?: Record<string, unknown>;
}
export interface A2ATaskStatus {
    state: A2ATaskState;
    timestamp?: string;
    message?: A2AMessage;
}
export interface A2AArtifact {
    artifactId: string;
    name?: string;
    description?: string;
    parts: A2APart[];
    metadata?: Record<string, unknown>;
}
export interface A2ATask {
    id: string;
    contextId: string;
    status: A2ATaskStatus;
    history?: A2AMessage[];
    artifacts?: A2AArtifact[];
    metadata?: Record<string, unknown>;
}
export interface A2AAgentCard {
    agentId: string;
    name: string;
    description?: string;
    url: string;
    protocolVersions: string[];
    capabilities: {
        streaming?: boolean;
        pushNotifications?: boolean;
        extendedAgentCard?: boolean;
        stateTransitionHistory?: boolean;
    };
    skills?: Array<{
        id: string;
        name: string;
        description?: string;
        inputModes?: string[];
        outputModes?: string[];
        tags?: string[];
        examples?: string[];
    }>;
    defaultInputModes?: string[];
    defaultOutputModes?: string[];
    provider?: {
        organization?: string;
        url?: string;
    };
    documentationUrl?: string;
}
export interface A2ASendMessageInput {
    message: A2AMessage;
    configuration?: {
        acceptedOutputModes?: string[];
        historyLength?: number;
        blocking?: boolean;
    };
    metadata?: Record<string, unknown>;
}
export interface A2AListTasksInput {
    contextId?: string;
    status?: A2ATaskState;
    pageSize?: number;
    pageToken?: string;
    historyLength?: number;
    includeArtifacts?: boolean;
}
export interface A2AListTasksResponse {
    tasks: A2ATask[];
    nextPageToken: string;
    pageSize: number;
    totalSize: number;
}
export declare class KronovaSDKBase {
    private config;
    assets: AssetsClient;
    embeddings: EmbeddingsClient;
    datasets: DatasetsClient;
    tokenization: TokenizationClient;
    stablecoins: StablecoinsClient;
    agents: AgentsClient;
    workflows: WorkflowsClient;
    dataStreams: DataStreamsClient;
    oauth: OAuthClient_SDK;
    a2a: A2AClient;
    constructor(config: KronovaConfig);
    /**
     * Make an authenticated API request
     */
    request<T>(method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE", path: string, options?: {
        body?: unknown;
        params?: Record<string, string | number | boolean | undefined>;
        headers?: Record<string, string>;
        baseUrl?: string;
    }): Promise<APIResponse<T>>;
    /**
     * Get SDK configuration
     */
    getConfig(): Readonly<Required<KronovaConfig>>;
}
export declare class KronovaAPIError extends Error {
    status: number;
    response: unknown;
    constructor(message: string, status: number, response?: unknown);
}
export declare class ResenditAPIError extends KronovaAPIError {
    constructor(message: string, status: number, response?: unknown);
}
declare class AssetsClient {
    private sdk;
    constructor(sdk: KronovaSDKBase);
    list(params?: PaginationParams): Promise<APIResponse<Asset[]>>;
    get(id: string): Promise<APIResponse<Asset>>;
    create(input: CreateAssetInput): Promise<APIResponse<Asset>>;
    update(id: string, input: Partial<CreateAssetInput>): Promise<APIResponse<Asset>>;
    delete(id: string): Promise<APIResponse<{
        deleted: boolean;
    }>>;
    generateInsights(id: string): Promise<APIResponse<AssetInsights>>;
}
declare class EmbeddingsClient {
    private sdk;
    constructor(sdk: KronovaSDKBase);
    list(params?: PaginationParams & {
        dataset_id?: string;
    }): Promise<APIResponse<Embedding[]>>;
    get(id: string): Promise<APIResponse<Embedding>>;
    create(input: CreateEmbeddingInput): Promise<APIResponse<Embedding>>;
    createBatch(inputs: CreateEmbeddingInput[]): Promise<APIResponse<Embedding[]>>;
    delete(id: string): Promise<APIResponse<{
        deleted: boolean;
    }>>;
    search(query: string, options?: {
        dataset_id?: string;
        limit?: number;
        threshold?: number;
    }): Promise<APIResponse<EmbeddingSearchResult[]>>;
}
declare class DatasetsClient {
    private sdk;
    constructor(sdk: KronovaSDKBase);
    list(params?: PaginationParams): Promise<APIResponse<Dataset[]>>;
    get(id: string): Promise<APIResponse<Dataset>>;
    create(input: {
        name: string;
        description?: string;
    }): Promise<APIResponse<Dataset>>;
    delete(id: string): Promise<APIResponse<{
        deleted: boolean;
    }>>;
}
declare class TokenizationClient {
    private sdk;
    constructor(sdk: KronovaSDKBase);
    list(params?: PaginationParams): Promise<APIResponse<TokenizedAsset[]>>;
    get(id: string): Promise<APIResponse<TokenizedAsset>>;
    tokenize(input: TokenizeAssetInput): Promise<APIResponse<TokenizedAsset>>;
    fractionalize(input: FractionalizeInput): Promise<APIResponse<TokenizedAsset>>;
    burn(id: string): Promise<APIResponse<{
        burned: boolean;
    }>>;
}
declare class StablecoinsClient {
    private sdk;
    constructor(sdk: KronovaSDKBase);
    list(params?: PaginationParams): Promise<APIResponse<Stablecoin[]>>;
    get(id: string): Promise<APIResponse<Stablecoin>>;
    create(input: CreateStablecoinInput): Promise<APIResponse<Stablecoin>>;
    mint(id: string, input: MintStablecoinInput): Promise<APIResponse<{
        transaction_id: string;
        new_supply: string;
    }>>;
    burn(id: string, input: BurnStablecoinInput): Promise<APIResponse<{
        transaction_id: string;
        new_supply: string;
    }>>;
    transfer(id: string, input: TransferStablecoinInput): Promise<APIResponse<{
        transaction_id: string;
    }>>;
}
declare class AgentsClient {
    private sdk;
    constructor(sdk: KronovaSDKBase);
    list(params?: PaginationParams): Promise<APIResponse<Agent[]>>;
    get(id: string): Promise<APIResponse<Agent>>;
    execute(id: string, input: ExecuteAgentInput): Promise<APIResponse<AgentExecutionResult>>;
    executeStream(id: string, input: ExecuteAgentInput): AsyncGenerator<string, void, unknown>;
}
declare class WorkflowsClient {
    private sdk;
    constructor(sdk: KronovaSDKBase);
    list(params?: PaginationParams): Promise<APIResponse<Workflow[]>>;
    get(id: string): Promise<APIResponse<Workflow>>;
    execute(id: string, input: ExecuteWorkflowInput): Promise<APIResponse<WorkflowExecutionResult>>;
}
declare class DataStreamsClient {
    private sdk;
    constructor(sdk: KronovaSDKBase);
    /**
     * Subscribe to real-time data streams using Server-Sent Events
     */
    subscribe(config: DataStreamConfig, callbacks: {
        onMessage: (data: unknown) => void;
        onError?: (error: Error) => void;
        onClose?: () => void;
    }): {
        close: () => void;
    };
    /**
     * Poll for data stream updates (for environments that don't support SSE)
     */
    poll(config: DataStreamConfig): Promise<APIResponse<unknown[]>>;
}
declare class OAuthClient_SDK {
    private sdk;
    constructor(sdk: KronovaSDKBase);
    listClients(): Promise<APIResponse<OAuthClient[]>>;
    createClient(input: {
        client_name: string;
        redirect_uris: string[];
        scopes: string[];
    }): Promise<APIResponse<OAuthClient & {
        client_secret: string;
    }>>;
    /**
     * Generate authorization URL for OAuth 2.1 flow
     */
    getAuthorizationUrl(params: {
        client_id: string;
        redirect_uri: string;
        scope: string;
        state: string;
        code_challenge: string;
        code_challenge_method?: "S256";
    }): string;
    /**
     * Exchange authorization code for tokens
     */
    exchangeCode(params: {
        code: string;
        client_id: string;
        client_secret: string;
        redirect_uri: string;
        code_verifier: string;
    }): Promise<APIResponse<OAuthTokenResponse>>;
    /**
     * Refresh access token
     */
    refreshToken(params: {
        refresh_token: string;
        client_id: string;
        client_secret: string;
    }): Promise<APIResponse<OAuthTokenResponse>>;
}
declare class A2AClient {
    private sdk;
    constructor(sdk: KronovaSDKBase);
    /**
     * The A2A endpoint lives at /api/a2a on the app origin, outside the versioned /api/v1 surface.
     */
    private call;
    /** List public Agent Cards. Does not require authentication. */
    discover(): Promise<{
        agents: A2AAgentCard[];
        protocolVersion: string;
    }>;
    /** List Agent Cards owned by the API key's user (raw database rows). Requires `read:agents`. */
    listAgentCards(): Promise<{
        cards: Record<string, unknown>[];
    }>;
    getAgentCard(agentId: string): Promise<A2AAgentCard>;
    /** Requires `write:agents`. The server assigns the `agentId`. */
    createAgentCard(card: Omit<A2AAgentCard, "agentId">): Promise<A2AAgentCard>;
    sendMessage(input: A2ASendMessageInput): Promise<A2ATask | A2AMessage>;
    getTask(taskId: string, historyLength?: number): Promise<A2ATask>;
    listTasks(params?: A2AListTasksInput): Promise<A2AListTasksResponse>;
    cancelTask(taskId: string): Promise<A2ATask>;
    updateTaskStatus(taskId: string, status: A2ATaskStatus): Promise<A2ATask>;
    addArtifact(taskId: string, artifact: A2AArtifact): Promise<A2AArtifact>;
    sendViaAetherNet(targetAddress: string, request: A2ASendMessageInput): Promise<unknown>;
}
export interface KairoMessage {
    role: "user" | "assistant";
    content: string;
}
export interface KairoSendResult {
    success: boolean;
    reply?: string;
    conversationId?: string;
    error?: string;
}
export interface KairoTranscribeResult {
    success: boolean;
    text?: string;
    error?: string;
}
/**
 * A single Server-Sent-Events chunk emitted by /support/message/stream.
 * "delta" chunks carry incremental text; "done" carries final metadata
 * once the platform has finished RAG retrieval, generation, and persistence.
 */
export type KairoStreamChunk = {
    type: "delta";
    text: string;
} | {
    type: "done";
    conversationId?: string;
} | {
    type: "error";
    error: string;
};
/**
 * KairoSupportClient — lightweight client for the Kairo chatbot API.
 *
 * Designed for use in external projects (e.g. kronova.io) that call
 * the Kronova platform API rather than running server actions directly.
 * Wraps /v1/support/message and /v1/support/transcribe endpoints.
 */
declare class KairoSupportClient {
    private sdk;
    constructor(sdk: KronovaSDKBase);
    /**
     * Send a message to Kairo and receive an AI-generated reply.
     * The platform handles RAG retrieval, persistence, and model routing.
     */
    send(messages: KairoMessage[], options?: {
        conversationId?: string;
        modelId?: string;
        inputMode?: "text" | "voice";
    }): Promise<APIResponse<KairoSendResult>>;
    /**
     * Send a message to Kairo and stream the reply as it's generated.
     * The platform still handles RAG retrieval, persistence, and model
     * routing server-side — only the response delivery is incremental.
     *
     * Consume with `for await (const chunk of sdk.support.sendStream(...))`.
     * Requires the platform's /support/message/stream endpoint (SSE).
     */
    sendStream(messages: KairoMessage[], options?: {
        conversationId?: string;
        modelId?: string;
        inputMode?: "text" | "voice";
        signal?: AbortSignal;
    }): AsyncGenerator<KairoStreamChunk, void, unknown>;
    /**
     * Transcribe an audio ArrayBuffer via the platform's voice pipeline.
     * Returns the transcribed text ready to pass to send().
     */
    transcribe(audioBuffer: ArrayBuffer): Promise<APIResponse<KairoTranscribeResult>>;
    /**
     * Close a support conversation — stamps ended_at on the session row.
     */
    closeConversation(conversationId: string): Promise<APIResponse<{
        closed: boolean;
    }>>;
}
/**
 * Kronova SDK - Primary branded SDK class
 */
export declare class KronovaSDK extends KronovaSDKBase {
    support: KairoSupportClient;
    constructor(config: KronovaConfig);
}
/** @deprecated Use KronovaSDK instead. Retained for backward compatibility. */
export declare const ResenditSDK: typeof KronovaSDK;
/**
 * Create a new Kronova SDK instance
 */
export declare function createKronovaClient(config: KronovaConfig): KronovaSDK;
/**
 * @deprecated Use createKronovaClient instead.
 */
export declare function createResenditClient(config: KronovaConfig): KronovaSDK;
export default KronovaSDK;
//# sourceMappingURL=kronova-sdk.d.ts.map