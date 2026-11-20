"use client"

import { useState, useCallback } from "react"
import { Play, Copy, Check, Loader2, ChevronDown, ChevronRight, Key, AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { cn } from "@/lib/utils"

// =============================================================================
// TYPES
// =============================================================================

interface EndpointParam {
  name: string
  type: "string" | "number" | "boolean" | "object" | "array"
  required: boolean
  description: string
  default?: string
  enum?: string[]
}

interface APIEndpoint {
  id: string
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE"
  path: string
  name: string
  description: string
  category: string
  params?: EndpointParam[]
  bodyParams?: EndpointParam[]
  responseExample: string
  requiresAuth: boolean
  scopes?: string[]
}

// =============================================================================
// ENDPOINT DEFINITIONS
// =============================================================================

const API_ENDPOINTS: APIEndpoint[] = [
  // Assets
  {
    id: "assets-list",
    method: "GET",
    path: "/assets",
    name: "List Assets",
    description: "Retrieve all assets for the authenticated user",
    category: "Assets",
    params: [
      { name: "page", type: "number", required: false, description: "Page number", default: "1" },
      { name: "limit", type: "number", required: false, description: "Items per page", default: "20" },
      {
        name: "type",
        type: "string",
        required: false,
        description: "Filter by asset type",
        enum: ["equipment", "vehicle", "real_estate", "inventory", "other"],
      },
      {
        name: "status",
        type: "string",
        required: false,
        description: "Filter by status",
        enum: ["active", "maintenance", "retired", "disposed"],
      },
    ],
    responseExample: `{
  "success": true,
  "data": [
    {
      "id": "ast_abc123",
      "name": "Industrial Sensor Array",
      "type": "equipment",
      "status": "active",
      "current_value": 45000,
      "created_at": "2024-01-15T10:30:00Z"
    }
  ],
  "meta": { "page": 1, "limit": 20, "total": 156 }
}`,
    requiresAuth: true,
    scopes: ["assets:read"],
  },
  {
    id: "assets-create",
    method: "POST",
    path: "/assets",
    name: "Create Asset",
    description: "Create a new asset record",
    category: "Assets",
    bodyParams: [
      { name: "name", type: "string", required: true, description: "Asset name" },
      {
        name: "type",
        type: "string",
        required: true,
        description: "Asset type",
        enum: ["equipment", "vehicle", "real_estate", "inventory", "other"],
      },
      { name: "description", type: "string", required: false, description: "Asset description" },
      { name: "acquisition_cost", type: "number", required: false, description: "Purchase price" },
      { name: "current_value", type: "number", required: false, description: "Current estimated value" },
    ],
    responseExample: `{
  "success": true,
  "data": {
    "id": "ast_xyz789",
    "name": "New Equipment",
    "type": "equipment",
    "status": "active",
    "created_at": "2024-06-01T14:00:00Z"
  }
}`,
    requiresAuth: true,
    scopes: ["assets:write"],
  },
  {
    id: "assets-insights",
    method: "POST",
    path: "/assets/{assetId}/insights",
    name: "Generate Asset Insights",
    description: "Generate AI-powered insights for an asset using predictive analytics",
    category: "Assets",
    params: [{ name: "assetId", type: "string", required: true, description: "Asset ID" }],
    responseExample: `{
  "success": true,
  "data": {
    "asset_id": "ast_abc123",
    "insights": "Based on usage patterns and sensor data...",
    "recommendations": [
      "Schedule preventive maintenance within 30 days",
      "Consider firmware upgrade to improve efficiency"
    ],
    "risk_factors": [
      "Bearing wear detected - medium priority"
    ],
    "maintenance_predictions": {
      "next_maintenance_date": "2024-07-15",
      "estimated_cost": 2500,
      "priority": "medium"
    },
    "generated_at": "2024-06-01T14:30:00Z"
  }
}`,
    requiresAuth: true,
    scopes: ["assets:read", "ai:execute"],
  },
  // Embeddings
  {
    id: "embeddings-search",
    method: "POST",
    path: "/embeddings/search",
    name: "Semantic Search",
    description: "Search embeddings using semantic similarity",
    category: "Embeddings",
    bodyParams: [
      { name: "query", type: "string", required: true, description: "Search query text" },
      { name: "dataset_id", type: "string", required: false, description: "Limit search to specific dataset" },
      { name: "limit", type: "number", required: false, description: "Maximum results", default: "10" },
      {
        name: "threshold",
        type: "number",
        required: false,
        description: "Minimum similarity score (0-1)",
        default: "0.7",
      },
    ],
    responseExample: `{
  "success": true,
  "data": [
    {
      "id": "emb_123",
      "content": "Maintenance procedures for industrial equipment...",
      "similarity": 0.92,
      "metadata": { "source": "manual_v2.pdf", "page": 45 }
    }
  ]
}`,
    requiresAuth: true,
    scopes: ["embeddings:read"],
  },
  {
    id: "embeddings-create",
    method: "POST",
    path: "/embeddings",
    name: "Create Embedding",
    description: "Generate and store an embedding for text content",
    category: "Embeddings",
    bodyParams: [
      { name: "content", type: "string", required: true, description: "Text content to embed" },
      { name: "dataset_id", type: "string", required: false, description: "Dataset to add embedding to" },
      { name: "metadata", type: "object", required: false, description: "Additional metadata" },
    ],
    responseExample: `{
  "success": true,
  "data": {
    "id": "emb_456",
    "content": "Your embedded content...",
    "embedding": [0.123, -0.456, ...],
    "created_at": "2024-06-01T15:00:00Z"
  }
}`,
    requiresAuth: true,
    scopes: ["embeddings:write"],
  },
  // Tokenization
  {
    id: "tokenization-create",
    method: "POST",
    path: "/tokenization",
    name: "Tokenize Asset",
    description: "Create a blockchain token representing an asset",
    category: "Tokenization",
    bodyParams: [
      { name: "asset_id", type: "string", required: true, description: "Asset to tokenize" },
      {
        name: "blockchain",
        type: "string",
        required: false,
        description: "Target blockchain",
        enum: ["sui", "canton", "ethereum"],
        default: "sui",
      },
      { name: "total_supply", type: "number", required: false, description: "Token supply", default: "1" },
      { name: "metadata", type: "object", required: false, description: "Token metadata" },
    ],
    responseExample: `{
  "success": true,
  "data": {
    "id": "tok_789",
    "asset_id": "ast_abc123",
    "token_id": "0x...",
    "blockchain": "sui",
    "total_supply": 1000,
    "status": "minted",
    "created_at": "2024-06-01T16:00:00Z"
  }
}`,
    requiresAuth: true,
    scopes: ["tokenization:write"],
  },
  {
    id: "tokenization-fractionalize",
    method: "POST",
    path: "/tokenization/fractionalize",
    name: "Fractionalize Token",
    description: "Split a token into fractional ownership shares",
    category: "Tokenization",
    bodyParams: [
      { name: "token_id", type: "string", required: true, description: "Token to fractionalize" },
      { name: "fraction_count", type: "number", required: true, description: "Number of fractions" },
      { name: "fraction_price", type: "number", required: false, description: "Price per fraction" },
    ],
    responseExample: `{
  "success": true,
  "data": {
    "id": "tok_789",
    "fractionalized": true,
    "fraction_count": 100,
    "fraction_price": 500,
    "updated_at": "2024-06-01T17:00:00Z"
  }
}`,
    requiresAuth: true,
    scopes: ["tokenization:write"],
  },
  // Stablecoins
  {
    id: "stablecoins-create",
    method: "POST",
    path: "/stablecoins",
    name: "Deploy Stablecoin",
    description: "Deploy a new private stablecoin on Canton Network",
    category: "Stablecoins",
    bodyParams: [
      { name: "name", type: "string", required: true, description: "Stablecoin name" },
      { name: "symbol", type: "string", required: true, description: "Token symbol (3-5 chars)" },
      { name: "decimals", type: "number", required: false, description: "Decimal places", default: "6" },
      {
        name: "backing_type",
        type: "string",
        required: true,
        description: "Collateral type",
        enum: ["usdc", "multi_collateral", "algorithmic"],
      },
      { name: "initial_supply", type: "string", required: false, description: "Initial token supply" },
    ],
    responseExample: `{
  "success": true,
  "data": {
    "id": "stb_001",
    "name": "Enterprise USD",
    "symbol": "eUSD",
    "decimals": 6,
    "total_supply": "1000000000000",
    "backing_type": "usdc",
    "backing_ratio": 1.0,
    "status": "active",
    "contract_address": "canton://...",
    "created_at": "2024-06-01T18:00:00Z"
  }
}`,
    requiresAuth: true,
    scopes: ["stablecoins:write"],
  },
  {
    id: "stablecoins-mint",
    method: "POST",
    path: "/stablecoins/{stablecoinId}/mint",
    name: "Mint Stablecoin",
    description: "Mint new stablecoin tokens with USDC backing",
    category: "Stablecoins",
    params: [{ name: "stablecoinId", type: "string", required: true, description: "Stablecoin ID" }],
    bodyParams: [
      { name: "amount", type: "string", required: true, description: "Amount to mint (in base units)" },
      { name: "recipient_address", type: "string", required: true, description: "Recipient wallet address" },
      { name: "backing_transaction_id", type: "string", required: false, description: "Circle USDC transaction ID" },
    ],
    responseExample: `{
  "success": true,
  "data": {
    "transaction_id": "tx_mint_123",
    "new_supply": "2000000000000",
    "minted_amount": "1000000000000",
    "recipient": "canton://party/...",
    "backing_verified": true
  }
}`,
    requiresAuth: true,
    scopes: ["stablecoins:mint"],
  },
  // Agents
  {
    id: "agents-execute",
    method: "POST",
    path: "/agents/{agentId}/execute",
    name: "Execute Agent",
    description: "Execute an AI agent with a prompt",
    category: "AI Agents",
    params: [{ name: "agentId", type: "string", required: true, description: "Agent ID" }],
    bodyParams: [
      { name: "prompt", type: "string", required: true, description: "User prompt/instruction" },
      { name: "context", type: "object", required: false, description: "Additional context data" },
      { name: "asset_ids", type: "array", required: false, description: "Assets to include in context" },
      { name: "stream", type: "boolean", required: false, description: "Enable streaming response", default: "false" },
    ],
    responseExample: `{
  "success": true,
  "data": {
    "id": "exec_abc123",
    "agent_id": "agt_xyz",
    "prompt": "Analyze maintenance needs for Q3",
    "response": "Based on the asset data provided...",
    "tokens_used": 1250,
    "execution_time_ms": 2340,
    "created_at": "2024-06-01T19:00:00Z"
  }
}`,
    requiresAuth: true,
    scopes: ["agents:execute"],
  },
  // Data Streams
  {
    id: "datastreams-agents",
    method: "GET",
    path: "/data-streams/agents",
    name: "Agent Data Stream",
    description: "Subscribe to real-time agent execution events via SSE",
    category: "Data Streams",
    params: [
      {
        name: "format",
        type: "string",
        required: false,
        description: "Response format",
        enum: ["sse", "json"],
        default: "sse",
      },
      { name: "agent_id", type: "string", required: false, description: "Filter by specific agent" },
    ],
    responseExample: `event: agent_started
data: {"agent_id":"agt_xyz","execution_id":"exec_123","timestamp":"2024-06-01T20:00:00Z"}

event: agent_completed
data: {"agent_id":"agt_xyz","execution_id":"exec_123","tokens_used":500,"timestamp":"2024-06-01T20:00:05Z"}`,
    requiresAuth: true,
    scopes: ["datastreams:read"],
  },
  {
    id: "datastreams-iot",
    method: "GET",
    path: "/data-streams/iot-sensors",
    name: "IoT Sensor Stream",
    description: "Subscribe to real-time IoT sensor data via SSE",
    category: "Data Streams",
    params: [
      {
        name: "format",
        type: "string",
        required: false,
        description: "Response format",
        enum: ["sse", "json"],
        default: "sse",
      },
      { name: "sensor_id", type: "string", required: false, description: "Filter by specific sensor" },
      { name: "asset_id", type: "string", required: false, description: "Filter by asset" },
    ],
    responseExample: `event: sensor_reading
data: {"sensor_id":"sns_001","asset_id":"ast_123","reading":{"temperature":72.5,"humidity":45},"timestamp":"2024-06-01T20:01:00Z"}`,
    requiresAuth: true,
    scopes: ["datastreams:read"],
  },
]

// =============================================================================
// COMPONENTS
// =============================================================================

interface PlaygroundState {
  apiKey: string
  selectedEndpoint: APIEndpoint | null
  params: Record<string, string>
  body: string
  response: string | null
  loading: boolean
  error: string | null
}

export function APIPlayground() {
  const [state, setState] = useState<PlaygroundState>({
    apiKey: "",
    selectedEndpoint: null,
    params: {},
    body: "{}",
    response: null,
    loading: false,
    error: null,
  })
  const [copied, setCopied] = useState<string | null>(null)
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(["Assets"]))

  const categories = Array.from(new Set(API_ENDPOINTS.map((e) => e.category)))

  const selectEndpoint = useCallback((endpoint: APIEndpoint) => {
    const defaultParams: Record<string, string> = {}
    endpoint.params?.forEach((p) => {
      if (p.default) defaultParams[p.name] = p.default
    })

    const defaultBody: Record<string, unknown> = {}
    endpoint.bodyParams?.forEach((p) => {
      if (p.required) {
        defaultBody[p.name] = p.type === "number" ? 0 : p.type === "boolean" ? false : ""
      }
    })

    setState((prev) => ({
      ...prev,
      selectedEndpoint: endpoint,
      params: defaultParams,
      body: Object.keys(defaultBody).length > 0 ? JSON.stringify(defaultBody, null, 2) : "{}",
      response: null,
      error: null,
    }))
  }, [])

  const executeRequest = async () => {
    if (!state.selectedEndpoint || !state.apiKey) {
      setState((prev) => ({ ...prev, error: "Please enter your API key" }))
      return
    }

    setState((prev) => ({ ...prev, loading: true, error: null, response: null }))

    try {
      let path = state.selectedEndpoint.path
      const queryParams = new URLSearchParams()

      // Replace path parameters and build query string
      Object.entries(state.params).forEach(([key, value]) => {
        if (path.includes(`{${key}}`)) {
          path = path.replace(`{${key}}`, value)
        } else if (value) {
          queryParams.append(key, value)
        }
      })

      const url = `/api/v1${path}${queryParams.toString() ? "?" + queryParams.toString() : ""}`

      const options: RequestInit = {
        method: state.selectedEndpoint.method,
        headers: {
          Authorization: `Bearer ${state.apiKey}`,
          "Content-Type": "application/json",
        },
      }

      if (["POST", "PUT", "PATCH"].includes(state.selectedEndpoint.method)) {
        options.body = state.body
      }

      const response = await fetch(url, options)
      const data = await response.json()

      setState((prev) => ({
        ...prev,
        loading: false,
        response: JSON.stringify(data, null, 2),
        error: !response.ok ? `HTTP ${response.status}: ${data.error || "Request failed"}` : null,
      }))
    } catch (err) {
      setState((prev) => ({
        ...prev,
        loading: false,
        error: err instanceof Error ? err.message : "Request failed",
      }))
    }
  }

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text)
    setCopied(id)
    setTimeout(() => setCopied(null), 2000)
  }

  const generateCurlCommand = () => {
    if (!state.selectedEndpoint) return ""

    let path = state.selectedEndpoint.path
    const queryParams = new URLSearchParams()

    Object.entries(state.params).forEach(([key, value]) => {
      if (path.includes(`{${key}}`)) {
        path = path.replace(`{${key}}`, value)
      } else if (value) {
        queryParams.append(key, value)
      }
    })

    const url = `https://app.kronova.io/api/v1${path}${queryParams.toString() ? "?" + queryParams.toString() : ""}`

    let curl = `curl -X ${state.selectedEndpoint.method} "${url}" \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json"`

    if (["POST", "PUT", "PATCH"].includes(state.selectedEndpoint.method) && state.body !== "{}") {
      curl += ` \\
  -d '${state.body}'`
    }

    return curl
  }

  const generateSDKCode = () => {
    if (!state.selectedEndpoint) return ""

    const endpoint = state.selectedEndpoint
    let code = `import { createKronovaClient } from '@kronova-intelligent-systems/sdk'

const client = createKronovaClient({ apiKey: 'YOUR_API_KEY' })

`

    switch (endpoint.category) {
      case "Assets":
        if (endpoint.id === "assets-list") {
          code += `const { data } = await client.assets.list(${state.params.type ? `{ type: '${state.params.type}' }` : ""})`
        } else if (endpoint.id === "assets-create") {
          code += `const { data } = await client.assets.create(${state.body})`
        } else if (endpoint.id === "assets-insights") {
          code += `const { data } = await client.assets.generateInsights('${state.params.assetId || "ASSET_ID"}')`
        }
        break
      case "Embeddings":
        if (endpoint.id === "embeddings-search") {
          code += `const { data } = await client.embeddings.search('${JSON.parse(state.body || "{}").query || "search query"}')`
        } else if (endpoint.id === "embeddings-create") {
          code += `const { data } = await client.embeddings.create(${state.body})`
        }
        break
      case "Tokenization":
        if (endpoint.id === "tokenization-create") {
          code += `const { data } = await client.tokenization.tokenize(${state.body})`
        } else if (endpoint.id === "tokenization-fractionalize") {
          code += `const { data } = await client.tokenization.fractionalize(${state.body})`
        }
        break
      case "Stablecoins":
        if (endpoint.id === "stablecoins-create") {
          code += `const { data } = await client.stablecoins.create(${state.body})`
        } else if (endpoint.id === "stablecoins-mint") {
          code += `const { data } = await client.stablecoins.mint('${state.params.stablecoinId || "STABLECOIN_ID"}', ${state.body})`
        }
        break
      case "AI Agents":
        code += `const { data } = await client.agents.execute('${state.params.agentId || "AGENT_ID"}', ${state.body})`
        break
      case "Data Streams":
        code += `const subscription = client.dataStreams.subscribe(
  { stream_type: '${endpoint.path.split("/").pop()}' },
  {
    onMessage: (data) => console.log('Received:', data),
    onError: (err) => console.error('Error:', err),
  }
)

// Later: subscription.close()`
        break
      default:
        code += `// SDK method for ${endpoint.name}`
    }

    return code
  }

  const toggleCategory = (category: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev)
      if (next.has(category)) {
        next.delete(category)
      } else {
        next.add(category)
      }
      return next
    })
  }

  return (
    <div className="grid lg:grid-cols-4 gap-6">
      {/* Endpoint Selector */}
      <div className="lg:col-span-1 space-y-2">
        <div className="sticky top-4">
          <h3 className="font-semibold mb-3">Endpoints</h3>
          <div className="space-y-1 max-h-[calc(100vh-200px)] overflow-y-auto pr-2">
            {categories.map((category) => (
              <Collapsible
                key={category}
                open={expandedCategories.has(category)}
                onOpenChange={() => toggleCategory(category)}
              >
                <CollapsibleTrigger className="flex items-center justify-between w-full p-2 hover:bg-muted rounded-md text-sm font-medium">
                  {category}
                  {expandedCategories.has(category) ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                </CollapsibleTrigger>
                <CollapsibleContent className="pl-2 space-y-1">
                  {API_ENDPOINTS.filter((e) => e.category === category).map((endpoint) => (
                    <button
                      key={endpoint.id}
                      onClick={() => selectEndpoint(endpoint)}
                      className={cn(
                        "w-full text-left p-2 rounded-md text-sm flex items-center gap-2 transition-colors",
                        state.selectedEndpoint?.id === endpoint.id
                          ? "bg-primary text-primary-foreground"
                          : "hover:bg-muted",
                      )}
                    >
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-xs font-mono",
                          endpoint.method === "GET" && "border-green-500 text-green-600",
                          endpoint.method === "POST" && "border-blue-500 text-blue-600",
                          endpoint.method === "PUT" && "border-yellow-500 text-yellow-600",
                          endpoint.method === "PATCH" && "border-orange-500 text-orange-600",
                          endpoint.method === "DELETE" && "border-red-500 text-red-600",
                        )}
                      >
                        {endpoint.method}
                      </Badge>
                      <span className="truncate">{endpoint.name}</span>
                    </button>
                  ))}
                </CollapsibleContent>
              </Collapsible>
            ))}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="lg:col-span-3 space-y-6">
        {/* API Key Input */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Key className="h-5 w-5" />
              Authentication
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4">
              <div className="flex-1">
                <Label htmlFor="apiKey" className="sr-only">
                  API Key
                </Label>
                <Input
                  id="apiKey"
                  type="password"
                  placeholder="Enter your API key (sk_live_...)"
                  value={state.apiKey}
                  onChange={(e) => setState((prev) => ({ ...prev, apiKey: e.target.value }))}
                />
              </div>
              <Button variant="outline" asChild>
                <a href="/dashboard/api-keys" target="_blank" rel="noreferrer">
                  Get API Key
                </a>
              </Button>
            </div>
          </CardContent>
        </Card>

        {state.selectedEndpoint ? (
          <>
            {/* Endpoint Info */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Badge
                        className={cn(
                          "font-mono",
                          state.selectedEndpoint.method === "GET" && "bg-green-500",
                          state.selectedEndpoint.method === "POST" && "bg-blue-500",
                          state.selectedEndpoint.method === "PUT" && "bg-yellow-500",
                          state.selectedEndpoint.method === "PATCH" && "bg-orange-500",
                          state.selectedEndpoint.method === "DELETE" && "bg-red-500",
                        )}
                      >
                        {state.selectedEndpoint.method}
                      </Badge>
                      <code className="text-lg">/api/v1{state.selectedEndpoint.path}</code>
                    </CardTitle>
                    <CardDescription className="mt-1">{state.selectedEndpoint.description}</CardDescription>
                  </div>
                  <Button onClick={executeRequest} disabled={state.loading || !state.apiKey} className="gap-2">
                    {state.loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                    Execute
                  </Button>
                </div>
                {state.selectedEndpoint.scopes && (
                  <div className="flex gap-1 mt-2">
                    <span className="text-xs text-muted-foreground">Required scopes:</span>
                    {state.selectedEndpoint.scopes.map((scope) => (
                      <Badge key={scope} variant="secondary" className="text-xs">
                        {scope}
                      </Badge>
                    ))}
                  </div>
                )}
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Parameters */}
                {state.selectedEndpoint.params && state.selectedEndpoint.params.length > 0 && (
                  <div>
                    <Label className="text-sm font-medium">Parameters</Label>
                    <div className="grid gap-3 mt-2">
                      {state.selectedEndpoint.params.map((param) => (
                        <div key={param.name} className="grid gap-1.5">
                          <div className="flex items-center gap-2">
                            <Label htmlFor={param.name} className="text-sm">
                              {param.name}
                              {param.required && <span className="text-red-500 ml-1">*</span>}
                            </Label>
                            <span className="text-xs text-muted-foreground">({param.type})</span>
                          </div>
                          {param.enum ? (
                            <Select
                              value={state.params[param.name] || ""}
                              onValueChange={(value) =>
                                setState((prev) => ({
                                  ...prev,
                                  params: { ...prev.params, [param.name]: value },
                                }))
                              }
                            >
                              <SelectTrigger id={param.name}>
                                <SelectValue placeholder={param.description} />
                              </SelectTrigger>
                              <SelectContent>
                                {param.enum.map((opt) => (
                                  <SelectItem key={opt} value={opt}>
                                    {opt}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : (
                            <Input
                              id={param.name}
                              type={param.type === "number" ? "number" : "text"}
                              placeholder={param.description}
                              value={state.params[param.name] || ""}
                              onChange={(e) =>
                                setState((prev) => ({
                                  ...prev,
                                  params: { ...prev.params, [param.name]: e.target.value },
                                }))
                              }
                            />
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Request Body */}
                {state.selectedEndpoint.bodyParams && state.selectedEndpoint.bodyParams.length > 0 && (
                  <div>
                    <Label className="text-sm font-medium">Request Body</Label>
                    <div className="mt-2 text-xs text-muted-foreground mb-2">
                      {state.selectedEndpoint.bodyParams.map((p) => (
                        <span key={p.name} className="mr-3">
                          <code>{p.name}</code>
                          {p.required && <span className="text-red-500">*</span>} ({p.type})
                        </span>
                      ))}
                    </div>
                    <Textarea
                      value={state.body}
                      onChange={(e) => setState((prev) => ({ ...prev, body: e.target.value }))}
                      className="font-mono text-sm min-h-[120px]"
                    />
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Code Examples */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Code Examples</CardTitle>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="curl">
                  <TabsList>
                    <TabsTrigger value="curl">cURL</TabsTrigger>
                    <TabsTrigger value="sdk">SDK</TabsTrigger>
                  </TabsList>
                  <TabsContent value="curl" className="relative">
                    <pre className="bg-zinc-950 text-zinc-50 p-4 rounded-md text-sm overflow-x-auto">
                      {generateCurlCommand()}
                    </pre>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute top-2 right-2"
                      onClick={() => copyToClipboard(generateCurlCommand(), "curl")}
                    >
                      {copied === "curl" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    </Button>
                  </TabsContent>
                  <TabsContent value="sdk" className="relative">
                    <pre className="bg-zinc-950 text-zinc-50 p-4 rounded-md text-sm overflow-x-auto">
                      {generateSDKCode()}
                    </pre>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute top-2 right-2"
                      onClick={() => copyToClipboard(generateSDKCode(), "sdk")}
                    >
                      {copied === "sdk" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    </Button>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>

            {/* Response */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Response</CardTitle>
              </CardHeader>
              <CardContent>
                {state.error && (
                  <Alert variant="destructive" className="mb-4">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{state.error}</AlertDescription>
                  </Alert>
                )}
                {state.response ? (
                  <div className="relative">
                    <pre className="bg-zinc-950 text-zinc-50 p-4 rounded-md text-sm overflow-x-auto max-h-[400px]">
                      {state.response}
                    </pre>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute top-2 right-2"
                      onClick={() => copyToClipboard(state.response!, "response")}
                    >
                      {copied === "response" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    </Button>
                  </div>
                ) : (
                  <div className="relative">
                    <p className="text-sm text-muted-foreground mb-2">Example Response:</p>
                    <pre className="bg-zinc-950 text-zinc-50 p-4 rounded-md text-sm overflow-x-auto max-h-[400px]">
                      {state.selectedEndpoint.responseExample}
                    </pre>
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        ) : (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">Select an endpoint from the sidebar to get started</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
