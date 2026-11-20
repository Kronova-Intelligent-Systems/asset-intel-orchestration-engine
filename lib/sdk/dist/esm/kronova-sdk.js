"use strict";
/**
 * @kronova-intelligent-systems/sdk
 * Official TypeScript/JavaScript SDK for the Kronova Asset Intelligence Platform
 *
 * @version 2.0.0
 * @license MIT
 * @see https://docs.kronova.io
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ResenditSDK = exports.KronovaSDK = exports.ResenditAPIError = exports.KronovaAPIError = exports.KronovaSDKBase = exports.A2A_PROTOCOL_VERSION = void 0;
exports.createKronovaClient = createKronovaClient;
exports.createResenditClient = createResenditClient;
// A2A Protocol Types (Agent2Agent Interoperability) - served at /api/a2a
exports.A2A_PROTOCOL_VERSION = "1.0";
// =============================================================================
// SDK IMPLEMENTATION
// =============================================================================
class KronovaSDKBase {
    constructor(config) {
        this.config = {
            apiKey: config.apiKey,
            baseUrl: config.baseUrl || "https://app.kronova.io/api/v1",
            timeout: config.timeout || 30000,
            retries: config.retries || 3,
            debug: config.debug || false,
        };
        // Initialize sub-clients
        this.assets = new AssetsClient(this);
        this.embeddings = new EmbeddingsClient(this);
        this.datasets = new DatasetsClient(this);
        this.tokenization = new TokenizationClient(this);
        this.stablecoins = new StablecoinsClient(this);
        this.agents = new AgentsClient(this);
        this.workflows = new WorkflowsClient(this);
        this.dataStreams = new DataStreamsClient(this);
        this.oauth = new OAuthClient_SDK(this);
        this.a2a = new A2AClient(this);
    }
    /**
     * Make an authenticated API request
     */
    async request(method, path, options = {}) {
        const url = new URL(`${options.baseUrl ?? this.config.baseUrl}${path}`);
        // Add query parameters
        if (options.params) {
            Object.entries(options.params).forEach(([key, value]) => {
                if (value !== undefined) {
                    url.searchParams.append(key, String(value));
                }
            });
        }
        const headers = {
            Authorization: `Bearer ${this.config.apiKey}`,
            "Content-Type": "application/json",
            "X-SDK-Version": "2.0.0",
            ...options.headers,
        };
        let lastError = null;
        for (let attempt = 0; attempt < this.config.retries; attempt++) {
            try {
                if (this.config.debug) {
                    console.log(`[KronovaSDK] ${method} ${url.toString()}`);
                }
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);
                const response = await fetch(url.toString(), {
                    method,
                    headers,
                    body: options.body ? JSON.stringify(options.body) : undefined,
                    signal: controller.signal,
                });
                clearTimeout(timeoutId);
                const data = await response.json();
                if (!response.ok) {
                    throw new KronovaAPIError(data.error || `HTTP ${response.status}`, response.status, data);
                }
                return data;
            }
            catch (error) {
                lastError = error;
                // Don't retry on client errors (4xx)
                if (error instanceof KronovaAPIError && error.status >= 400 && error.status < 500) {
                    throw error;
                }
                // Wait before retry with exponential backoff
                if (attempt < this.config.retries - 1) {
                    await new Promise((resolve) => setTimeout(resolve, Math.pow(2, attempt) * 1000));
                }
            }
        }
        throw lastError || new Error("Request failed after retries");
    }
    /**
     * Get SDK configuration
     */
    getConfig() {
        return { ...this.config };
    }
}
exports.KronovaSDKBase = KronovaSDKBase;
// =============================================================================
// ERROR CLASSES
// =============================================================================
class KronovaAPIError extends Error {
    constructor(message, status, response) {
        super(message);
        this.name = "KronovaAPIError";
        this.status = status;
        this.response = response;
    }
}
exports.KronovaAPIError = KronovaAPIError;
// Legacy error class for backward compatibility
class ResenditAPIError extends KronovaAPIError {
    constructor(message, status, response) {
        super(message, status, response);
        this.name = "ResenditAPIError";
    }
}
exports.ResenditAPIError = ResenditAPIError;
// =============================================================================
// SUB-CLIENTS
// =============================================================================
class AssetsClient {
    constructor(sdk) {
        this.sdk = sdk;
    }
    async list(params) {
        return this.sdk.request("GET", "/assets", { params });
    }
    async get(id) {
        return this.sdk.request("GET", `/assets/${id}`);
    }
    async create(input) {
        return this.sdk.request("POST", "/assets", { body: input });
    }
    async update(id, input) {
        return this.sdk.request("PATCH", `/assets/${id}`, { body: input });
    }
    async delete(id) {
        return this.sdk.request("DELETE", `/assets/${id}`);
    }
    async generateInsights(id) {
        return this.sdk.request("POST", `/assets/${id}/insights`);
    }
}
class EmbeddingsClient {
    constructor(sdk) {
        this.sdk = sdk;
    }
    async list(params) {
        return this.sdk.request("GET", "/embeddings", { params });
    }
    async get(id) {
        return this.sdk.request("GET", `/embeddings/${id}`);
    }
    async create(input) {
        return this.sdk.request("POST", "/embeddings", { body: input });
    }
    async createBatch(inputs) {
        return this.sdk.request("POST", "/embeddings", { body: { embeddings: inputs } });
    }
    async delete(id) {
        return this.sdk.request("DELETE", `/embeddings/${id}`);
    }
    async search(query, options) {
        return this.sdk.request("POST", "/embeddings/search", {
            body: { query, ...options },
        });
    }
}
class DatasetsClient {
    constructor(sdk) {
        this.sdk = sdk;
    }
    async list(params) {
        return this.sdk.request("GET", "/datasets", { params });
    }
    async get(id) {
        return this.sdk.request("GET", `/datasets/${id}`);
    }
    async create(input) {
        return this.sdk.request("POST", "/datasets", { body: input });
    }
    async delete(id) {
        return this.sdk.request("DELETE", `/datasets/${id}`);
    }
}
class TokenizationClient {
    constructor(sdk) {
        this.sdk = sdk;
    }
    async list(params) {
        return this.sdk.request("GET", "/tokenization", { params });
    }
    async get(id) {
        return this.sdk.request("GET", `/tokenization/${id}`);
    }
    async tokenize(input) {
        return this.sdk.request("POST", "/tokenization", { body: input });
    }
    async fractionalize(input) {
        return this.sdk.request("POST", "/tokenization/fractionalize", { body: input });
    }
    async burn(id) {
        return this.sdk.request("DELETE", `/tokenization/${id}`);
    }
}
class StablecoinsClient {
    constructor(sdk) {
        this.sdk = sdk;
    }
    async list(params) {
        return this.sdk.request("GET", "/stablecoins", { params });
    }
    async get(id) {
        return this.sdk.request("GET", `/stablecoins/${id}`);
    }
    async create(input) {
        return this.sdk.request("POST", "/stablecoins", { body: input });
    }
    async mint(id, input) {
        return this.sdk.request("POST", `/stablecoins/${id}/mint`, { body: input });
    }
    async burn(id, input) {
        return this.sdk.request("POST", `/stablecoins/${id}/burn`, { body: input });
    }
    async transfer(id, input) {
        return this.sdk.request("POST", `/stablecoins/${id}/transfer`, { body: input });
    }
}
class AgentsClient {
    constructor(sdk) {
        this.sdk = sdk;
    }
    async list(params) {
        return this.sdk.request("GET", "/agents", { params });
    }
    async get(id) {
        return this.sdk.request("GET", `/agents/${id}`);
    }
    async execute(id, input) {
        return this.sdk.request("POST", `/agents/${id}/execute`, { body: input });
    }
    async *executeStream(id, input) {
        const config = this.sdk.getConfig();
        const url = `${config.baseUrl}/agents/${id}/execute`;
        const response = await fetch(url, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${config.apiKey}`,
                "Content-Type": "application/json",
                Accept: "text/event-stream",
            },
            body: JSON.stringify({ ...input, stream: true }),
        });
        if (!response.ok) {
            throw new KronovaAPIError(`HTTP ${response.status}`, response.status);
        }
        const reader = response.body?.getReader();
        if (!reader) {
            throw new Error("No response body");
        }
        const decoder = new TextDecoder();
        let buffer = "";
        try {
            while (true) {
                const { done, value } = await reader.read();
                if (done)
                    break;
                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split("\n");
                buffer = lines.pop() || "";
                for (const line of lines) {
                    if (line.startsWith("data: ")) {
                        const data = line.slice(6);
                        if (data === "[DONE]")
                            return;
                        yield data;
                    }
                }
            }
        }
        finally {
            reader.releaseLock();
        }
    }
}
class WorkflowsClient {
    constructor(sdk) {
        this.sdk = sdk;
    }
    async list(params) {
        return this.sdk.request("GET", "/workflows", { params });
    }
    async get(id) {
        return this.sdk.request("GET", `/workflows/${id}`);
    }
    async execute(id, input) {
        return this.sdk.request("POST", `/workflows/${id}/execute`, { body: input });
    }
}
class DataStreamsClient {
    constructor(sdk) {
        this.sdk = sdk;
    }
    /**
     * Subscribe to real-time data streams using Server-Sent Events
     */
    subscribe(config, callbacks) {
        const sdkConfig = this.sdk.getConfig();
        const url = new URL(`${sdkConfig.baseUrl}/data-streams/${config.stream_type}`);
        url.searchParams.set("format", "sse");
        if (config.filters) {
            url.searchParams.set("filters", JSON.stringify(config.filters));
        }
        const eventSource = new EventSource(url.toString(), {
        // Note: EventSource doesn't support custom headers in browsers
        // For authenticated streams, use the polling method or WebSocket
        });
        eventSource.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                callbacks.onMessage(data);
            }
            catch {
                callbacks.onMessage(event.data);
            }
        };
        eventSource.onerror = () => {
            callbacks.onError?.(new Error("EventSource connection error"));
        };
        return {
            close: () => {
                eventSource.close();
                callbacks.onClose?.();
            },
        };
    }
    /**
     * Poll for data stream updates (for environments that don't support SSE)
     */
    async poll(config) {
        return this.sdk.request("GET", `/data-streams/${config.stream_type}`, {
            params: {
                format: "json",
                filters: config.filters ? JSON.stringify(config.filters) : undefined,
            },
        });
    }
}
class OAuthClient_SDK {
    constructor(sdk) {
        this.sdk = sdk;
    }
    async listClients() {
        return this.sdk.request("GET", "/oauth/clients");
    }
    async createClient(input) {
        return this.sdk.request("POST", "/oauth/clients", { body: input });
    }
    /**
     * Generate authorization URL for OAuth 2.1 flow
     */
    getAuthorizationUrl(params) {
        const config = this.sdk.getConfig();
        const baseUrl = config.baseUrl.replace("/api/v1", "");
        const url = new URL(`${baseUrl}/api/v1/oauth/authorize`);
        url.searchParams.set("response_type", "code");
        url.searchParams.set("client_id", params.client_id);
        url.searchParams.set("redirect_uri", params.redirect_uri);
        url.searchParams.set("scope", params.scope);
        url.searchParams.set("state", params.state);
        url.searchParams.set("code_challenge", params.code_challenge);
        url.searchParams.set("code_challenge_method", params.code_challenge_method || "S256");
        return url.toString();
    }
    /**
     * Exchange authorization code for tokens
     */
    async exchangeCode(params) {
        return this.sdk.request("POST", "/oauth/token", {
            body: {
                grant_type: "authorization_code",
                ...params,
            },
        });
    }
    /**
     * Refresh access token
     */
    async refreshToken(params) {
        return this.sdk.request("POST", "/oauth/token", {
            body: {
                grant_type: "refresh_token",
                ...params,
            },
        });
    }
}
class A2AClient {
    constructor(sdk) {
        this.sdk = sdk;
    }
    /**
     * The A2A endpoint lives at /api/a2a on the app origin, outside the versioned /api/v1 surface.
     */
    call(method, options = {}) {
        const baseUrl = `${new URL(this.sdk.getConfig().baseUrl).origin}/api/a2a`;
        return this.sdk.request(method, "", {
            ...options,
            baseUrl,
            headers: { "A2A-Version": exports.A2A_PROTOCOL_VERSION },
        });
    }
    /** List public Agent Cards. Does not require authentication. */
    async discover() {
        return this.call("GET", { params: { action: "discover" } });
    }
    /** List Agent Cards owned by the API key's user (raw database rows). Requires `read:agents`. */
    async listAgentCards() {
        return this.call("GET", { params: { action: "list-cards" } });
    }
    async getAgentCard(agentId) {
        return this.call("GET", { params: { agentId } });
    }
    /** Requires `write:agents`. The server assigns the `agentId`. */
    async createAgentCard(card) {
        return this.call("POST", { body: { action: "agentCard/create", card } });
    }
    async sendMessage(input) {
        return this.call("POST", { body: { action: "message/send", ...input } });
    }
    async getTask(taskId, historyLength) {
        return this.call("GET", { params: { taskId, historyLength } });
    }
    async listTasks(params = {}) {
        return this.call("GET", { params: { action: "list-tasks", ...params } });
    }
    async cancelTask(taskId) {
        return this.call("POST", { body: { action: "tasks/cancel", taskId } });
    }
    async updateTaskStatus(taskId, status) {
        return this.call("POST", { body: { action: "tasks/updateStatus", taskId, status } });
    }
    async addArtifact(taskId, artifact) {
        return this.call("POST", { body: { action: "tasks/addArtifact", taskId, artifact } });
    }
    async sendViaAetherNet(targetAddress, request) {
        return this.call("POST", { body: { action: "aethernet/send", targetAddress, request } });
    }
}
/**
 * KairoSupportClient — lightweight client for the Kairo chatbot API.
 *
 * Designed for use in external projects (e.g. kronova.io) that call
 * the Kronova platform API rather than running server actions directly.
 * Wraps /v1/support/message and /v1/support/transcribe endpoints.
 */
class KairoSupportClient {
    constructor(sdk) {
        this.sdk = sdk;
    }
    /**
     * Send a message to Kairo and receive an AI-generated reply.
     * The platform handles RAG retrieval, persistence, and model routing.
     */
    async send(messages, options) {
        return this.sdk.request("POST", "/support/message", {
            body: {
                messages,
                conversation_id: options?.conversationId,
                model_id: options?.modelId ?? "openai/gpt-4o",
                input_mode: options?.inputMode ?? "text",
            },
        });
    }
    /**
     * Send a message to Kairo and stream the reply as it's generated.
     * The platform still handles RAG retrieval, persistence, and model
     * routing server-side — only the response delivery is incremental.
     *
     * Consume with `for await (const chunk of sdk.support.sendStream(...))`.
     * Requires the platform's /support/message/stream endpoint (SSE).
     */
    async *sendStream(messages, options) {
        const config = this.sdk.getConfig();
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
        });
        if (!response.ok || !response.body) {
            throw new KronovaAPIError(`HTTP ${response.status}`, response.status);
        }
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        try {
            while (true) {
                const { done, value } = await reader.read();
                if (done)
                    break;
                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split("\n");
                buffer = lines.pop() ?? "";
                for (const line of lines) {
                    const trimmed = line.trim();
                    if (!trimmed.startsWith("data:"))
                        continue;
                    const payload = trimmed.slice(5).trim();
                    if (payload === "[DONE]")
                        return;
                    try {
                        yield JSON.parse(payload);
                    }
                    catch {
                        // Skip malformed SSE frames rather than aborting the whole stream.
                    }
                }
            }
        }
        finally {
            reader.releaseLock();
        }
    }
    /**
     * Transcribe an audio ArrayBuffer via the platform's voice pipeline.
     * Returns the transcribed text ready to pass to send().
     */
    async transcribe(audioBuffer) {
        const config = this.sdk.getConfig();
        const url = `${config.baseUrl}/support/transcribe`;
        const blob = new Blob([audioBuffer], { type: "audio/wav" });
        const formData = new FormData();
        formData.append("audio", blob, "audio.wav");
        const response = await fetch(url, {
            method: "POST",
            headers: { Authorization: `Bearer ${config.apiKey}` },
            body: formData,
        });
        if (!response.ok) {
            throw new KronovaAPIError(`HTTP ${response.status}`, response.status);
        }
        return response.json();
    }
    /**
     * Close a support conversation — stamps ended_at on the session row.
     */
    async closeConversation(conversationId) {
        return this.sdk.request("POST", `/support/conversations/${conversationId}/close`);
    }
}
// =============================================================================
// FACTORY FUNCTION
// =============================================================================
/**
 * Kronova SDK - Primary branded SDK class
 */
class KronovaSDK extends KronovaSDKBase {
    constructor(config) {
        super(config);
        this.support = new KairoSupportClient(this);
    }
}
exports.KronovaSDK = KronovaSDK;
/** @deprecated Use KronovaSDK instead. Retained for backward compatibility. */
exports.ResenditSDK = KronovaSDK;
/**
 * Create a new Kronova SDK instance
 */
function createKronovaClient(config) {
    return new KronovaSDK(config);
}
/**
 * @deprecated Use createKronovaClient instead.
 */
function createResenditClient(config) {
    return new KronovaSDK(config);
}
// Default export
exports.default = KronovaSDK;
