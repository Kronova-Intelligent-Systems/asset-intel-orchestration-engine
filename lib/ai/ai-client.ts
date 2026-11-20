// Define the supported AI providers
export type AIProvider =
  | "openai"
  | "anthropic"
  | "meta"
  | "mistral"
  | "google"
  | "stability"
  | "local"
  | "azure_openai"
  | "vertex_ai"
  | "groq"
  | "deepseek"
  | "xai"
  | "perplexity"
  | "aws_bedrock"
  | "deepinfra"
  | "openrouter"
  | "novita"
  | "baseten"
  | "fireworks"
  | "cerebras"
  | "nebius"
  | "canopy_wave"
  | "chutes"

// Define the common parameters for AI requests
export interface AIRequestParams {
  model: string
  messages: Array<{
    role: "system" | "user" | "assistant" | "function" | "tool"
    content:
      | string
      | Array<{
          type: "text" | "image_url"
          text?: string
          image_url?: {
            url: string
            detail?: "low" | "high" | "auto"
          }
        }>
    name?: string
    function_call?: {
      name: string
      arguments: string
    }
    tool_calls?: Array<{
      id: string
      type: "function"
      function: {
        name: string
        arguments: string
      }
    }>
    tool_call_id?: string
  }>
  temperature?: number
  top_p?: number
  max_tokens?: number
  stream?: boolean
  tools?: Array<{
    type: "function"
    function: {
      name: string
      description: string
      parameters: Record<string, any>
    }
  }>
  tool_choice?:
    | "auto"
    | "none"
    | {
        type: "function"
        function: {
          name: string
        }
      }
  response_format?: {
    type: "json_object" | "text"
  }
}

// Define the common response structure
export interface AIResponse {
  id: string
  model: string
  created: number
  choices: Array<{
    index: number
    message: {
      role: "assistant" | "function" | "tool"
      content: string | null
      tool_calls?: Array<{
        id: string
        type: "function"
        function: {
          name: string
          arguments: string
        }
      }>
    }
    finish_reason: "stop" | "length" | "tool_calls" | "content_filter"
  }>
  usage: {
    prompt_tokens: number
    completion_tokens: number
    total_tokens: number
  }
}

// Define the streaming response chunk
export interface AIStreamChunk {
  id: string
  model: string
  created: number
  choices: Array<{
    index: number
    delta: {
      role?: "assistant" | "function" | "tool"
      content?: string
      tool_calls?: Array<{
        index: number
        id?: string
        type?: "function"
        function?: {
          name?: string
          arguments?: string
        }
      }>
    }
    finish_reason: null | "stop" | "length" | "tool_calls" | "content_filter"
  }>
}

// Define the image generation parameters
export interface ImageGenerationParams {
  prompt: string
  model?: string
  n?: number
  size?: "256x256" | "512x512" | "1024x1024" | "1792x1024" | "1024x1792"
  quality?: "standard" | "hd"
  style?: "vivid" | "natural"
  response_format?: "url" | "b64_json"
}

// Define the image generation response
export interface ImageGenerationResponse {
  created: number
  data: Array<{
    url?: string
    b64_json?: string
    revised_prompt?: string
  }>
}

// Define the embedding parameters
export interface EmbeddingParams {
  model: string
  input: string | string[]
  encoding_format?: "float" | "base64"
  dimensions?: number
  user?: string
}

// Define the embedding response
export interface EmbeddingResponse {
  data: Array<{
    embedding: number[]
    index: number
    object: string
  }>
  model: string
  object: string
  usage: {
    prompt_tokens: number
    total_tokens: number
  }
}

// Define the tool interface
export interface Tool {
  name: string
  description: string
  parameters: {
    type: "object"
    properties: Record<string, any>
    required: string[]
  }
  execute: (params: Record<string, any>) => Promise<any>
}

// Define the agent execution options
export interface AgentExecutionOptions {
  maxIterations?: number
  timeoutMs?: number
  verbose?: boolean
}

// Define the agent execution result
export interface AgentExecutionResult {
  agentId: string
  finalResponse: string
  iterations: number
  toolCalls: Array<{
    tool: string
    params: Record<string, any>
    result: any
  }>
  tokens: {
    prompt: number
    completion: number
    total: number
  }
  elapsedMs: number
}

// Main AI client class
export class AIClient {
  private apiKey: string
  private provider: AIProvider
  private baseUrl: string
  private defaultModel: string

  constructor(provider: AIProvider, apiKey: string, defaultModel?: string) {
    this.provider = provider
    this.apiKey = apiKey

    // Set the base URL based on the provider
    switch (provider) {
      case "openai":
        this.baseUrl = "https://api.openai.com/v1"
        this.defaultModel = defaultModel || this.getLatestOpenAIModel()
        break
      case "anthropic":
        this.baseUrl = "https://api.anthropic.com/v1"
        this.defaultModel = defaultModel || "claude-3-opus-20240229"
        break
      case "mistral":
        this.baseUrl = "https://api.mistral.ai/v1"
        this.defaultModel = defaultModel || "mistral-large-2"
        break
      case "google":
        // Updated Google API endpoint to use the AI Studio API
        this.baseUrl = "https://generativelanguage.googleapis.com/v1"
        this.defaultModel = defaultModel || "gemini-2.5-pro"
        break
      case "meta":
        this.baseUrl = "https://api.llama-api.com"
        this.defaultModel = defaultModel || "meta/llama-3-70b-instruct"
        break
      case "stability":
        this.baseUrl = "https://api.stability.ai/v1"
        this.defaultModel = defaultModel || "stable-diffusion-xl"
        break
      case "local":
        this.baseUrl = "http://localhost:8000"
        this.defaultModel = defaultModel || "local-model"
        break
      case "azure_openai":
        this.baseUrl = process.env.AZURE_OPENAI_ENDPOINT || "https://your-resource.openai.azure.com"
        this.defaultModel = defaultModel || "gpt-4o"
        break
      case "vertex_ai":
        this.baseUrl = "https://us-central1-aiplatform.googleapis.com/v1"
        this.defaultModel = defaultModel || "gemini-pro"
        break
      case "groq":
        this.baseUrl = "https://api.groq.com/openai/v1"
        this.defaultModel = defaultModel || "llama-3.3-70b-versatile"
        break
      case "deepseek":
        this.baseUrl = "https://api.deepseek.com/v1"
        this.defaultModel = defaultModel || "deepseek-chat"
        break
      case "xai":
        this.baseUrl = "https://api.x.ai/v1"
        this.defaultModel = defaultModel || "grok-3"
        break
      case "perplexity":
        this.baseUrl = "https://api.perplexity.ai"
        this.defaultModel = defaultModel || "sonar-pro"
        break
      case "aws_bedrock":
        this.baseUrl = `https://bedrock-runtime.${process.env.AWS_REGION || "us-east-1"}.amazonaws.com`
        this.defaultModel = defaultModel || "anthropic.claude-3-5-sonnet"
        break
      case "deepinfra":
        this.baseUrl = "https://api.deepinfra.com/v1/openai"
        this.defaultModel = defaultModel || "meta-llama/Llama-3.3-70B-Instruct"
        break
      case "openrouter":
        this.baseUrl = "https://openrouter.ai/api/v1"
        this.defaultModel = defaultModel || "auto"
        break
      case "novita":
        this.baseUrl = "https://api.novita.ai/v3/openai"
        this.defaultModel = defaultModel || "meta-llama/llama-3.1-70b-instruct"
        break
      case "baseten":
        this.baseUrl = "https://model-{model_id}.api.baseten.co/production/predict"
        this.defaultModel = defaultModel || "llama-3.1-405b"
        break
      case "fireworks":
        this.baseUrl = "https://api.fireworks.ai/inference/v1"
        this.defaultModel = defaultModel || "accounts/fireworks/models/llama-v3p3-70b-instruct"
        break
      case "cerebras":
        this.baseUrl = "https://api.cerebras.ai/v1"
        this.defaultModel = defaultModel || "llama3.3-70b"
        break
      case "nebius":
        this.baseUrl = "https://api.studio.nebius.ai/v1"
        this.defaultModel = defaultModel || "meta-llama/Meta-Llama-3.1-70B-Instruct"
        break
      case "canopy_wave":
        this.baseUrl = "https://api.canopywave.io/v1"
        this.defaultModel = defaultModel || "deepseek-r1"
        break
      case "chutes":
        this.baseUrl = "https://llm.chutes.ai/v1"
        this.defaultModel = defaultModel || "deepseek-ai/DeepSeek-V3"
        break
      default:
        throw new Error(`Unsupported provider: ${provider}`)
    }
  }

  private getLatestOpenAIModel(): string {
    // Return the most advanced model available, prioritizing GPT-5 if available
    const availableModels = ["gpt-5", "gpt-4.1", "gpt-4o", "gpt-4-turbo", "gpt-4"]
    return availableModels.length > 0 ? availableModels[0] : "gpt-4o" // Default to GPT-4o as fallback
  }

  private validateOpenAIModel(model: string): boolean {
    const supportedModels = [
      // GPT-5 series
      "gpt-5",
      "gpt-5-mini",
      // GPT-4.1 series
      "gpt-4.1",
      "gpt-4.1-mini",
      "gpt-4.1-nano",
      // Existing GPT-4 series
      "gpt-4o",
      "gpt-4o-mini",
      "gpt-4-turbo",
      "gpt-4-turbo-preview",
      "gpt-4",
      "gpt-4-32k",
      // GPT-3.5 series
      "gpt-3.5-turbo",
      "gpt-3.5-turbo-16k",
    ]
    return supportedModels.includes(model)
  }

  // Method to create chat completions
  async createChatCompletion(params: AIRequestParams): Promise<AIResponse> {
    const model = params.model || this.defaultModel

    if (this.provider === "openai" && !this.validateOpenAIModel(model)) {
      console.warn(`Model ${model} may not be supported. Proceeding with request.`)
    }

    const endpoint = this.getChatCompletionEndpoint(model)
    const requestBody = this.formatChatCompletionRequest(params)

    // Special handling for Google's Gemini models
    if (this.provider === "google") {
      try {
        console.log(`Making request to Google API: ${this.baseUrl}${endpoint}`)

        const response = await fetch(`${this.baseUrl}${endpoint}?key=${this.apiKey}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(requestBody),
        })

        if (!response.ok) {
          const errorText = await response.text()
          let errorMessage = `Status ${response.status}: ${response.statusText}`

          try {
            const errorJson = JSON.parse(errorText)
            errorMessage = errorJson.error?.message || errorMessage
          } catch (e) {
            // If parsing fails, use the raw text
            errorMessage = errorText || errorMessage
          }

          throw new Error(`AI API Error: ${errorMessage}`)
        }

        const data = await response.json()
        return this.formatChatCompletionResponse(data)
      } catch (error) {
        console.error("Error with Google API:", error)
        throw error
      }
    }

    // Standard handling for other providers
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method: "POST",
      headers: this.getHeaders(),
      body: JSON.stringify(requestBody),
    })

    // Add special logging for Meta models
    if (this.provider === "meta") {
      console.log(`Meta API request to: ${this.baseUrl}${endpoint}`)
      console.log(`Meta API headers: ${JSON.stringify(this.getHeaders())}`)
      console.log(`Meta API request body: ${JSON.stringify(requestBody)}`)
    }

    if (!response.ok) {
      const error = await response.json()
      throw new Error(`AI API Error: ${error.error?.message || response.statusText}`)
    }

    return this.formatChatCompletionResponse(await response.json())
  }

  // Method to create streaming chat completions
  async createStreamingChatCompletion(params: AIRequestParams, onChunk: (chunk: AIStreamChunk) => void): Promise<void> {
    const model = params.model || this.defaultModel
    const endpoint = this.getChatCompletionEndpoint(model)

    const requestBody = this.formatChatCompletionRequest({
      ...params,
      stream: true,
    })

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method: "POST",
      headers: this.getHeaders(),
      body: JSON.stringify(requestBody),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(`AI API Error: ${error.error?.message || response.statusText}`)
    }

    if (!response.body) {
      throw new Error("Response body is null")
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder("utf-8")

    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value)
        const lines = chunk.split("\n").filter((line) => line.trim() !== "" && line.trim() !== "data: [DONE]")

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6))
              onChunk(this.formatStreamChunk(data))
            } catch (e) {
              console.error("Error parsing stream chunk:", e)
            }
          }
        }
      }
    } finally {
      reader.releaseLock()
    }
  }

  // Method to generate images
  async generateImage(params: ImageGenerationParams): Promise<ImageGenerationResponse> {
    const endpoint = this.getImageGenerationEndpoint()
    const requestBody = this.formatImageGenerationRequest(params)

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method: "POST",
      headers: this.getHeaders(),
      body: JSON.stringify(requestBody),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(`AI API Error: ${error.error?.message || response.statusText}`)
    }

    return this.formatImageGenerationResponse(await response.json())
  }

  // Method to create embeddings
  async createEmbedding(params: EmbeddingParams): Promise<EmbeddingResponse> {
    const endpoint = this.getEmbeddingEndpoint()
    const requestBody = this.formatEmbeddingRequest(params)

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method: "POST",
      headers: this.getHeaders(),
      body: JSON.stringify(requestBody),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(`AI API Error: ${error.error?.message || response.statusText}`)
    }

    return this.formatEmbeddingResponse(await response.json())
  }

  // Helper methods for endpoint determination
  private getChatCompletionEndpoint(model: string): string {
    switch (this.provider) {
      case "openai":
      case "groq":
      case "deepseek":
      case "xai":
      case "deepinfra":
      case "novita":
      case "fireworks":
      case "cerebras":
      case "nebius":
      case "canopy_wave":
      case "chutes":
        return "/chat/completions"
      case "anthropic":
        return "/messages"
      case "mistral":
        return "/chat/completions"
      case "google":
        // Use the correct endpoint format for Google's Gemini models
        return `/models/${encodeURIComponent(model)}:generateContent`
      case "meta":
        return "/v1/completions"
      case "local":
        return "/v1/chat/completions"
      case "azure_openai":
        return `/openai/deployments/${model}/chat/completions?api-version=2024-02-15-preview`
      case "vertex_ai":
        return `/projects/${process.env.GCP_PROJECT_ID}/locations/us-central1/publishers/google/models/${model}:generateContent`
      case "perplexity":
        return "/chat/completions"
      case "aws_bedrock":
        return `/model/${model}/invoke`
      case "openrouter":
        return "/chat/completions"
      case "baseten":
        return ""
      default:
        throw new Error(`Unsupported provider for chat completion: ${this.provider}`)
    }
  }

  private getImageGenerationEndpoint(): string {
    switch (this.provider) {
      case "openai":
        return "/images/generations"
      case "stability":
        return "/generation/stable-diffusion-xl/text-to-image"
      default:
        throw new Error(`Unsupported provider for image generation: ${this.provider}`)
    }
  }

  private getEmbeddingEndpoint(): string {
    switch (this.provider) {
      case "openai":
      case "mistral":
      case "local":
        return "/embeddings"
      case "azure_openai":
        return `/openai/deployments/${this.defaultModel}/embeddings?api-version=2024-02-15-preview`
      case "vertex_ai":
        return `/projects/${process.env.GCP_PROJECT_ID}/locations/us-central1/publishers/google/models/${this.defaultModel}:embeddings`
      case "baseten":
        return ""
      default:
        throw new Error(`Unsupported provider for embeddings: ${this.provider}`)
    }
  }

  // Helper methods for request formatting
  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    }

    switch (this.provider) {
      case "openai":
      case "groq":
      case "deepseek":
      case "xai":
      case "deepinfra":
      case "novita":
      case "fireworks":
      case "cerebras":
      case "nebius":
      case "canopy_wave":
      case "chutes":
        headers["Authorization"] = `Bearer ${this.apiKey}`
        break
      case "anthropic":
        headers["x-api-key"] = this.apiKey
        headers["anthropic-version"] = "2023-06-01"
        break
      case "mistral":
        headers["Authorization"] = `Bearer ${this.apiKey}`
        break
      case "google":
        // For Google, we'll add the API key as a query parameter instead
        break
      case "meta":
        headers["Authorization"] = `Bearer ${this.apiKey}`
        break
      case "stability":
        headers["Authorization"] = `Bearer ${this.apiKey}`
        break
      case "azure_openai":
        headers["api-key"] = this.apiKey
        break
      case "vertex_ai":
        headers["Authorization"] = `Bearer ${this.apiKey}`
        break
      case "aws_bedrock":
        // AWS Bedrock uses IAM authentication - handled separately
        break
      case "openrouter":
        headers["Authorization"] = `Bearer ${this.apiKey}`
        headers["HTTP-Referer"] = process.env.NEXT_PUBLIC_APP_URL || "https://kronova.io"
        headers["X-Title"] = "Kronova AI Suite"
        break
      case "baseten":
        headers["Authorization"] = `Api-Key ${this.apiKey}`
        break
      case "local":
        // No auth headers needed for local
        break
    }

    return headers
  }

  private formatChatCompletionRequest(params: AIRequestParams): any {
    switch (this.provider) {
      case "openai":
      case "groq":
      case "deepseek":
      case "xai":
      case "deepinfra":
      case "novita":
      case "fireworks":
      case "cerebras":
      case "nebius":
      case "canopy_wave":
      case "chutes":
        const openAIRequest = {
          model: params.model || this.defaultModel,
          messages: params.messages,
          temperature: params.temperature,
          top_p: params.top_p,
          max_tokens: params.max_tokens,
          stream: params.stream,
          tools: params.tools,
          tool_choice: params.tool_choice,
          response_format: params.response_format,
        }

        const model = params.model || this.defaultModel
        if (model.includes("nano")) {
          // Nano models have lower token limits
          openAIRequest.max_tokens = Math.min(openAIRequest.max_tokens || 2048, 2048)
        } else if (model.includes("mini")) {
          // Mini models have moderate token limits
          openAIRequest.max_tokens = Math.min(openAIRequest.max_tokens || 4096, 4096)
        } else if (model.includes("gpt-5") || model.includes("gpt-4.1")) {
          // Advanced models support higher token limits
          openAIRequest.max_tokens = openAIRequest.max_tokens || 8192
        }

        // GPT-5 and o-series reject max_tokens, temperature and top_p. The completion budget also
        // covers hidden reasoning tokens, so it needs headroom or the visible reply comes back empty.
        if (this.provider === "openai" && /^(gpt-5|o\d)/.test(model)) {
          const { max_tokens, temperature, top_p, ...rest } = openAIRequest
          return { ...rest, max_completion_tokens: Math.max(max_tokens ?? 0, 4096) }
        }

        return openAIRequest
      case "anthropic": {
        const anthropicModel = params.model || this.defaultModel
        // Claude 5 models and Opus 4.7+ deprecate sampling parameters and return 400 if they are sent.
        const rejectsSampling = /^claude-(fable|opus|sonnet|haiku)-5|^claude-opus-4-([7-9]|\d{2})/.test(anthropicModel)
        return {
          model: anthropicModel,
          messages: params.messages,
          ...(rejectsSampling ? {} : { temperature: params.temperature, top_p: params.top_p }),
          max_tokens: params.max_tokens,
          stream: params.stream,
        }
      }
      case "mistral":
        return {
          model: params.model || this.defaultModel,
          messages: params.messages,
          temperature: params.temperature,
          top_p: params.top_p,
          max_tokens: params.max_tokens,
          stream: params.stream,
          tools: params.tools,
          tool_choice: params.tool_choice,
        }
      case "google":
        // Updated format for Google's Gemini API
        return {
          contents: params.messages.map((msg) => ({
            role: msg.role === "user" ? "USER" : msg.role === "assistant" ? "MODEL" : "SYSTEM",
            parts: [{ text: typeof msg.content === "string" ? msg.content : JSON.stringify(msg.content) }],
          })),
          generationConfig: {
            temperature: params.temperature || 0.7,
            topP: params.top_p || 0.95,
            maxOutputTokens: params.max_tokens || 1024,
          },
        }
      case "meta":
        return {
          model: params.model || this.defaultModel,
          messages: params.messages.map((msg) => ({
            role: msg.role === "assistant" ? "assistant" : msg.role === "system" ? "system" : "user",
            content: typeof msg.content === "string" ? msg.content : JSON.stringify(msg.content),
          })),
          temperature: params.temperature || 0.7,
          top_p: params.top_p || 0.9,
          max_tokens: params.max_tokens || 800,
          stream: params.stream || false,
        }
      case "local":
        return {
          model: params.model || this.defaultModel,
          messages: params.messages,
          temperature: params.temperature,
          top_p: params.top_p,
          max_tokens: params.max_tokens,
          stream: params.stream,
          tools: params.tools,
          tool_choice: params.tool_choice,
        }
      case "azure_openai":
        return {
          model: params.model || this.defaultModel,
          messages: params.messages,
          temperature: params.temperature,
          top_p: params.top_p,
          max_tokens: params.max_tokens,
          stream: params.stream,
        }
      case "vertex_ai":
        return {
          model: params.model || this.defaultModel,
          messages: params.messages,
          temperature: params.temperature,
          top_p: params.top_p,
          max_output_tokens: params.max_tokens,
          stream: params.stream,
        }
      case "perplexity":
        return {
          model: params.model || this.defaultModel,
          messages: params.messages,
          temperature: params.temperature,
          top_p: params.top_p,
          max_tokens: params.max_tokens,
          stream: params.stream,
        }
      case "aws_bedrock":
        return {
          model: params.model || this.defaultModel,
          messages: params.messages,
          temperature: params.temperature,
          top_p: params.top_p,
          max_tokens: params.max_tokens,
          stream: params.stream,
        }
      case "openrouter":
        return {
          model: params.model || this.defaultModel,
          messages: params.messages,
          temperature: params.temperature,
          top_p: params.top_p,
          max_tokens: params.max_tokens,
          stream: params.stream,
        }
      case "baseten":
        return {
          model: params.model || this.defaultModel,
          messages: params.messages,
          temperature: params.temperature,
          top_p: params.top_p,
          max_tokens: params.max_tokens,
          stream: params.stream,
        }
      default:
        throw new Error(`Unsupported provider: ${this.provider}`)
    }
  }

  private formatImageGenerationRequest(params: ImageGenerationParams): any {
    switch (this.provider) {
      case "openai":
        return {
          model: params.model || "dall-e-3",
          prompt: params.prompt,
          n: params.n || 1,
          size: params.size || "1024x1024",
          quality: params.quality || "standard",
          style: params.style || "vivid",
          response_format: params.response_format || "url",
        }
      case "stability":
        return {
          text_prompts: [
            {
              text: params.prompt,
              weight: 1.0,
            },
          ],
          cfg_scale: 7.0,
          height: Number.parseInt(params.size?.split("x")[1] || "1024"),
          width: Number.parseInt(params.size?.split("x")[0] || "1024"),
          samples: params.n || 1,
          steps: 30,
        }
      case "azure_openai":
        return {
          model: params.model || this.defaultModel,
          prompt: params.prompt,
          n: params.n || 1,
          size: params.size || "1024x1024",
          quality: params.quality || "standard",
          style: params.style || "vivid",
          response_format: params.response_format || "url",
        }
      case "vertex_ai":
        return {
          model: params.model || this.defaultModel,
          prompt: params.prompt,
          n: params.n || 1,
          size: params.size || "1024x1024",
          quality: params.quality || "standard",
          style: params.style || "vivid",
          response_format: params.response_format || "url",
        }
      case "groq":
        return {
          model: params.model || this.defaultModel,
          prompt: params.prompt,
          n: params.n || 1,
          size: params.size || "1024x1024",
          quality: params.quality || "standard",
          style: params.style || "vivid",
          response_format: params.response_format || "url",
        }
      case "deepinfra":
        return {
          model: params.model || this.defaultModel,
          prompt: params.prompt,
          n: params.n || 1,
          size: params.size || "1024x1024",
          quality: params.quality || "standard",
          style: params.style || "vivid",
          response_format: params.response_format || "url",
        }
      case "novita":
        return {
          model: params.model || this.defaultModel,
          prompt: params.prompt,
          n: params.n || 1,
          size: params.size || "1024x1024",
          quality: params.quality || "standard",
          style: params.style || "vivid",
          response_format: params.response_format || "url",
        }
      case "baseten":
        return {
          model: params.model || this.defaultModel,
          prompt: params.prompt,
          n: params.n || 1,
          size: params.size || "1024x1024",
          quality: params.quality || "standard",
          style: params.style || "vivid",
          response_format: params.response_format || "url",
        }
      case "fireworks":
        return {
          model: params.model || this.defaultModel,
          prompt: params.prompt,
          n: params.n || 1,
          size: params.size || "1024x1024",
          quality: params.quality || "standard",
          style: params.style || "vivid",
          response_format: params.response_format || "url",
        }
      case "cerebras":
        return {
          model: params.model || this.defaultModel,
          prompt: params.prompt,
          n: params.n || 1,
          size: params.size || "1024x1024",
          quality: params.quality || "standard",
          style: params.style || "vivid",
          response_format: params.response_format || "url",
        }
      case "nebius":
        return {
          model: params.model || this.defaultModel,
          prompt: params.prompt,
          n: params.n || 1,
          size: params.size || "1024x1024",
          quality: params.quality || "standard",
          style: params.style || "vivid",
          response_format: params.response_format || "url",
        }
      case "canopy_wave":
        return {
          model: params.model || this.defaultModel,
          prompt: params.prompt,
          n: params.n || 1,
          size: params.size || "1024x1024",
          quality: params.quality || "standard",
          style: params.style || "vivid",
          response_format: params.response_format || "url",
        }
      case "chutes":
        return {
          model: params.model || this.defaultModel,
          prompt: params.prompt,
          n: params.n || 1,
          size: params.size || "1024x1024",
          quality: params.quality || "standard",
          style: params.style || "vivid",
          response_format: params.response_format || "url",
        }
      case "perplexity":
        return {
          model: params.model || this.defaultModel,
          prompt: params.prompt,
          n: params.n || 1,
          size: params.size || "1024x1024",
          quality: params.quality || "standard",
          style: params.style || "vivid",
          response_format: params.response_format || "url",
        }
      default:
        throw new Error(`Unsupported provider for image generation: ${this.provider}`)
    }
  }

  private formatEmbeddingRequest(params: EmbeddingParams): any {
    switch (this.provider) {
      case "openai":
      case "mistral":
      case "local":
        return {
          model: params.model,
          input: params.input,
          encoding_format: params.encoding_format || "float",
          dimensions: params.dimensions,
          user: params.user,
        }
      case "azure_openai":
        return {
          model: params.model,
          input: params.input,
          encoding_format: params.encoding_format || "float",
        }
      case "vertex_ai":
        return {
          model: params.model,
          input: params.input,
          encoding_format: params.encoding_format || "float",
        }
      case "baseten":
        return {
          model: params.model,
          input: params.input,
          encoding_format: params.encoding_format || "float",
        }
      case "groq":
        return {
          model: params.model,
          input: params.input,
          encoding_format: params.encoding_format || "float",
        }
      case "deepinfra":
        return {
          model: params.model,
          input: params.input,
          encoding_format: params.encoding_format || "float",
        }
      case "novita":
        return {
          model: params.model,
          input: params.input,
          encoding_format: params.encoding_format || "float",
        }
      case "fireworks":
        return {
          model: params.model,
          input: params.input,
          encoding_format: params.encoding_format || "float",
        }
      case "cerebras":
        return {
          model: params.model,
          input: params.input,
          encoding_format: params.encoding_format || "float",
        }
      case "nebius":
        return {
          model: params.model,
          input: params.input,
          encoding_format: params.encoding_format || "float",
        }
      case "canopy_wave":
        return {
          model: params.model,
          input: params.input,
          encoding_format: params.encoding_format || "float",
        }
      case "chutes":
        return {
          model: params.model,
          input: params.input,
          encoding_format: params.encoding_format || "float",
        }
      case "perplexity":
        return {
          model: params.model,
          input: params.input,
          encoding_format: params.encoding_format || "float",
        }
      default:
        throw new Error(`Unsupported provider for embeddings: ${this.provider}`)
    }
  }

  // Helper methods for response formatting
  private formatChatCompletionResponse(response: any): AIResponse {
    switch (this.provider) {
      case "openai":
      case "groq":
      case "deepseek":
      case "xai":
      case "deepinfra":
      case "novita":
      case "fireworks":
      case "cerebras":
      case "nebius":
      case "canopy_wave":
      case "chutes":
        return response
      case "anthropic":
        return {
          id: response.id,
          model: response.model,
          created: Math.floor(Date.now() / 1000),
          choices: [
            {
              index: 0,
              message: {
                role: "assistant",
                content: response.content.find((block: { type: string }) => block.type === "text")?.text ?? "",
              },
              finish_reason: response.stop_reason === "end_turn" ? "stop" : response.stop_reason,
            },
          ],
          usage: {
            prompt_tokens: response.usage.input_tokens,
            completion_tokens: response.usage.output_tokens,
            total_tokens: response.usage.input_tokens + response.usage.output_tokens,
          },
        }
      case "mistral":
        return response
      case "google":
        // Updated response formatting for Google's Gemini API
        return {
          id: response.name || `gemini-${Date.now()}`,
          model: response.model || this.defaultModel,
          created: Math.floor(Date.now() / 1000),
          choices: [
            {
              index: 0,
              message: {
                role: "assistant",
                content: response.candidates?.[0]?.content?.parts?.[0]?.text || "",
              },
              finish_reason: response.candidates?.[0]?.finishReason === "STOP" ? "stop" : "length",
            },
          ],
          usage: {
            prompt_tokens: response.usageMetadata?.promptTokenCount || 0,
            completion_tokens: response.usageMetadata?.candidatesTokenCount || 0,
            total_tokens:
              (response.usageMetadata?.promptTokenCount || 0) + (response.usageMetadata?.candidatesTokenCount || 0),
          },
        }
      case "meta":
        // Handle Meta's specific response format
        return {
          id: response.id || `meta-${Date.now()}`,
          model: response.model || this.defaultModel,
          created: Math.floor(Date.now() / 1000),
          choices: [
            {
              index: 0,
              message: {
                role: "assistant",
                content: response.choices?.[0]?.message?.content || response.choices?.[0]?.text || "",
              },
              finish_reason: response.choices?.[0]?.finish_reason || "stop",
            },
          ],
          usage: response.usage || {
            prompt_tokens: 0,
            completion_tokens: 0,
            total_tokens: 0,
          },
        }
      case "azure_openai":
        return {
          id: response.id,
          model: response.model,
          created: Math.floor(Date.now() / 1000),
          choices: [
            {
              index: 0,
              message: {
                role: "assistant",
                content: response.choices?.[0]?.message?.content || response.choices?.[0]?.text || "",
              },
              finish_reason: response.choices?.[0]?.finish_reason || "stop",
            },
          ],
          usage: response.usage || {
            prompt_tokens: 0,
            completion_tokens: 0,
            total_tokens: 0,
          },
        }
      case "vertex_ai":
        return {
          id: response.id,
          model: response.model,
          created: Math.floor(Date.now() / 1000),
          choices: [
            {
              index: 0,
              message: {
                role: "assistant",
                content: response.choices?.[0]?.message?.content || response.choices?.[0]?.text || "",
              },
              finish_reason: response.choices?.[0]?.finish_reason || "stop",
            },
          ],
          usage: response.usage || {
            prompt_tokens: 0,
            completion_tokens: 0,
            total_tokens: 0,
          },
        }
      case "perplexity":
        return {
          id: response.id,
          model: response.model,
          created: Math.floor(Date.now() / 1000),
          choices: [
            {
              index: 0,
              message: {
                role: "assistant",
                content: response.choices?.[0]?.message?.content || response.choices?.[0]?.text || "",
              },
              finish_reason: response.choices?.[0]?.finish_reason || "stop",
            },
          ],
          usage: response.usage || {
            prompt_tokens: 0,
            completion_tokens: 0,
            total_tokens: 0,
          },
        }
      case "aws_bedrock":
        return {
          id: response.id,
          model: response.model,
          created: Math.floor(Date.now() / 1000),
          choices: [
            {
              index: 0,
              message: {
                role: "assistant",
                content: response.choices?.[0]?.message?.content || response.choices?.[0]?.text || "",
              },
              finish_reason: response.choices?.[0]?.finish_reason || "stop",
            },
          ],
          usage: response.usage || {
            prompt_tokens: 0,
            completion_tokens: 0,
            total_tokens: 0,
          },
        }
      case "openrouter":
        return {
          id: response.id,
          model: response.model,
          created: Math.floor(Date.now() / 1000),
          choices: [
            {
              index: 0,
              message: {
                role: "assistant",
                content: response.choices?.[0]?.message?.content || response.choices?.[0]?.text || "",
              },
              finish_reason: response.choices?.[0]?.finish_reason || "stop",
            },
          ],
          usage: response.usage || {
            prompt_tokens: 0,
            completion_tokens: 0,
            total_tokens: 0,
          },
        }
      case "baseten":
        return response
      default:
        throw new Error(`Unsupported provider: ${this.provider}`)
    }
  }

  private formatStreamChunk(chunk: any): AIStreamChunk {
    switch (this.provider) {
      case "openai":
      case "groq":
      case "deepseek":
      case "xai":
      case "deepinfra":
      case "novita":
      case "fireworks":
      case "cerebras":
      case "nebius":
      case "canopy_wave":
      case "chutes":
        return chunk
      case "anthropic":
        return {
          id: chunk.id,
          model: chunk.model,
          created: Math.floor(Date.now() / 1000),
          choices: [
            {
              index: 0,
              delta: {
                role: chunk.type === "message_start" ? "assistant" : undefined,
                content: chunk.type === "content_block_delta" ? chunk.delta.text : undefined,
              },
              finish_reason: chunk.type === "message_stop" ? "stop" : null,
            },
          ],
        }
      case "mistral":
        return chunk
      case "meta":
        return chunk
      case "azure_openai":
        return chunk
      case "vertex_ai":
        return chunk
      case "perplexity":
        return chunk
      case "aws_bedrock":
        return chunk
      case "openrouter":
        return chunk
      case "baseten":
        return chunk
      default:
        throw new Error(`Unsupported provider for streaming: ${this.provider}`)
    }
  }

  private formatImageGenerationResponse(response: any): ImageGenerationResponse {
    switch (this.provider) {
      case "openai":
        return response
      case "stability":
        return {
          created: Math.floor(Date.now() / 1000),
          data: response.artifacts.map((artifact: any) => ({
            url: artifact.base64 ? `data:image/png;base64,${artifact.base64}` : undefined,
            b64_json: artifact.base64,
            revised_prompt: artifact.finishReason === "SUCCESS" ? undefined : "Error generating image",
          })),
        }
      case "azure_openai":
        return response
      case "vertex_ai":
        return response
      case "groq":
        return response
      case "deepinfra":
        return response
      case "novita":
        return response
      case "fireworks":
        return response
      case "cerebras":
        return response
      case "nebius":
        return response
      case "canopy_wave":
        return response
      case "chutes":
        return response
      case "perplexity":
        return response
      default:
        throw new Error(`Unsupported provider for image generation: ${this.provider}`)
    }
  }

  private formatEmbeddingResponse(response: any): EmbeddingResponse {
    switch (this.provider) {
      case "openai":
      case "mistral":
      case "local":
        return response
      case "azure_openai":
        return response
      case "vertex_ai":
        return response
      case "baseten":
        return response
      case "groq":
        return response
      case "deepinfra":
        return response
      case "novita":
        return response
      case "fireworks":
        return response
      case "cerebras":
        return response
      case "nebius":
        return response
      case "canopy_wave":
        return response
      case "chutes":
        return response
      case "perplexity":
        return response
      default:
        throw new Error(`Unsupported provider for embeddings: ${this.provider}`)
    }
  }
}
