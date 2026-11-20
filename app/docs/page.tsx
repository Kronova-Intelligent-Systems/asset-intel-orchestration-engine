import type { Metadata } from "next"
import Link from "next/link"
import {
  ArrowRight,
  Book,
  Code2,
  Coins,
  Database,
  FileJson,
  Key,
  Layers,
  Lock,
  Play,
  Server,
  Sparkles,
  Zap,
  Bot,
  Shield,
  Workflow,
  Radio,
  Terminal,
  CheckCircle2,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { APIPlayground } from "@/components/api-docs/api-playground"
import { AetherNetDocs } from "@/components/api-docs/aethernet-docs"
import { PlatformOverview } from "@/components/api-docs/platform-overview"
import { ApiConventions } from "@/components/api-docs/api-conventions"

export const metadata: Metadata = {
  title: "Documentation | Kronova Platform",
  description:
    "Kronova is a free, open-source (Apache 2.0) orchestration and intelligence platform and developer sandbox. Read the API reference and OpenAPI specification, try the playground, install the SDK, or self-host it.",
  alternates: { canonical: "/docs" },
}

const API_CATEGORIES = [
  {
    id: "assets",
    name: "Asset Intelligence",
    icon: Database,
    description: "Manage assets with AI-powered insights and predictive analytics",
    endpoints: [
      { method: "GET", path: "/assets", description: "List all assets" },
      { method: "POST", path: "/assets", description: "Create new asset" },
      { method: "POST", path: "/assets/{assetId}/insights", description: "Generate AI insights" },
    ],
  },
  {
    id: "embeddings",
    name: "Embeddings & Search",
    icon: Sparkles,
    description: "Vector embeddings for semantic search and RAG applications",
    endpoints: [
      { method: "GET", path: "/embeddings", description: "List embeddings" },
      { method: "POST", path: "/embeddings", description: "Create embedding" },
      { method: "GET", path: "/embeddings/{embeddingId}", description: "Get embedding" },
      { method: "PATCH", path: "/embeddings/{embeddingId}", description: "Update embedding" },
      { method: "DELETE", path: "/embeddings/{embeddingId}", description: "Delete embedding" },
      { method: "POST", path: "/embeddings/search", description: "Semantic search" },
      { method: "GET", path: "/datasets", description: "List datasets" },
      { method: "POST", path: "/datasets", description: "Create dataset" },
    ],
  },
  {
    id: "tokenization",
    name: "Asset Tokenization",
    icon: Layers,
    description: "Tokenize real-world assets on Sui and Canton blockchains",
    endpoints: [
      { method: "GET", path: "/tokenization", description: "List tokenized assets" },
      { method: "POST", path: "/tokenization", description: "Tokenize asset" },
      { method: "GET", path: "/tokenization/{tokenId}", description: "Get token details" },
      { method: "PATCH", path: "/tokenization/{tokenId}", description: "Update token" },
      { method: "POST", path: "/tokenization/fractionalize", description: "Fractionalize token" },
    ],
  },
  {
    id: "stablecoins",
    name: "Private Stablecoins",
    icon: Coins,
    description: "Deploy and manage USDC-backed stablecoins on Canton Network",
    endpoints: [
      { method: "GET", path: "/stablecoins", description: "List stablecoins" },
      { method: "POST", path: "/stablecoins", description: "Deploy stablecoin" },
      { method: "GET", path: "/stablecoins/{stablecoinId}", description: "Get stablecoin details" },
      { method: "POST", path: "/stablecoins/{stablecoinId}/mint", description: "Mint tokens" },
      { method: "POST", path: "/stablecoins/{stablecoinId}/burn", description: "Burn tokens" },
      { method: "POST", path: "/stablecoins/{stablecoinId}/transfer", description: "Transfer tokens" },
    ],
  },
  {
    id: "agents",
    name: "AI Agents",
    icon: Bot,
    description: "Execute intelligent AI agents for autonomous operations",
    endpoints: [
      { method: "POST", path: "/agents/{agentId}/execute", description: "Execute agent" },
    ],
  },
  {
    id: "workflows",
    name: "Workflows",
    icon: Workflow,
    description: "Orchestrate multi-step automated business processes",
    endpoints: [
      { method: "POST", path: "/workflows/{workflowId}/execute", description: "Execute workflow" },
    ],
  },
  {
    id: "datastreams",
    name: "Real-time Data Streams",
    icon: Radio,
    description: "Subscribe to live data feeds via Server-Sent Events",
    endpoints: [
      { method: "GET", path: "/data-streams", description: "List available streams" },
      { method: "GET", path: "/data-streams/agents", description: "Agent execution events" },
      { method: "GET", path: "/data-streams/workflows", description: "Workflow events" },
      { method: "GET", path: "/data-streams/iot-sensors", description: "IoT sensor readings" },
    ],
  },
  {
    id: "oauth",
    name: "OAuth 2.1 / MCP",
    icon: Shield,
    description: "OAuth 2.1 with PKCE for secure third-party integrations",
    endpoints: [
      { method: "GET", path: "/oauth/authorize", description: "Authorization endpoint" },
      { method: "POST", path: "/oauth/token", description: "Token exchange" },
      { method: "GET", path: "/oauth/clients", description: "List OAuth clients" },
      { method: "POST", path: "/oauth/clients", description: "Register OAuth client" },
    ],
  },
  {
    id: "voice",
    name: "Voice Interface",
    icon: Zap,
    description: "Voice-powered asset management with speech-to-text",
    endpoints: [
      { method: "POST", path: "/voice/sessions", description: "Create voice session" },
      { method: "GET", path: "/voice/sessions", description: "List voice sessions" },
      { method: "GET", path: "/voice/sessions/{sessionId}", description: "Get voice session" },
      { method: "PATCH", path: "/voice/sessions/{sessionId}", description: "Update voice session" },
      { method: "DELETE", path: "/voice/sessions/{sessionId}", description: "End voice session" },
      { method: "POST", path: "/voice/upload", description: "Upload audio" },
      { method: "POST", path: "/voice/process", description: "Process voice command" },
      { method: "POST", path: "/voice/synthesize", description: "Text-to-speech" },
    ],
  },
  {
    id: "data-stores",
    name: "Data Stores",
    icon: Database,
    description: "Connect and manage the data stores your agents and workflows read from",
    endpoints: [
      { method: "GET", path: "/data-stores", description: "List data stores" },
      { method: "POST", path: "/data-stores", description: "Create data store" },
      { method: "DELETE", path: "/data-stores/{id}", description: "Delete data store" },
    ],
  },
  {
    id: "deployment",
    name: "Deployment",
    icon: Server,
    description: "Register deployment targets and track deployment jobs",
    endpoints: [
      { method: "GET", path: "/deployment/targets", description: "List deployment targets" },
      { method: "POST", path: "/deployment/targets", description: "Register target" },
      { method: "DELETE", path: "/deployment/targets/{id}", description: "Remove target" },
      { method: "GET", path: "/deployment/jobs", description: "List deployment jobs" },
    ],
  },
  {
    id: "pqc",
    name: "Post-Quantum Keys",
    icon: Lock,
    description: "Manage the post-quantum signing keys used by AetherNet-aware agents",
    endpoints: [
      { method: "GET", path: "/pqc/keys", description: "List keys" },
      { method: "POST", path: "/pqc/keys", description: "Register key" },
      { method: "DELETE", path: "/pqc/keys", description: "Revoke key" },
      { method: "GET", path: "/pqc/platform-key", description: "Get platform public key" },
    ],
  },
]

const EDGE_FUNCTIONS = [
  { name: "execute-agent", description: "Execute AI agents with context injection" },
  { name: "execute-workflow", description: "Run multi-step automated workflows" },
  { name: "process-embeddings", description: "Generate vector embeddings for content" },
  { name: "process-database-embeddings", description: "Batch process database records" },
  { name: "tokenize-asset", description: "Mint blockchain tokens for assets" },
  { name: "stablecoin-operations", description: "Mint/burn private stablecoins" },
  { name: "process-ap2-mandate", description: "Process Agent Payments Protocol (AP2) mandates" },
  { name: "oauth-introspect", description: "Validate OAuth tokens" },
  { name: "voice-websocket", description: "Real-time voice processing" },
  { name: "voice-websocket-aethernet", description: "Voice with AetherNet integration" },
]

const TOTAL_OPERATIONS = API_CATEGORIES.reduce((total, category) => total + category.endpoints.length, 0)

const SDK_INSTALL = {
  npm: "npm install @kronova-intelligent-systems/sdk",
  yarn: "yarn add @kronova-intelligent-systems/sdk",
  pnpm: "pnpm add @kronova-intelligent-systems/sdk",
}

const QUICK_START_CODE = `import { createKronovaClient } from '@kronova-intelligent-systems/sdk'

// Initialize the client
const client = createKronovaClient({
  apiKey: process.env.KRONOVA_API_KEY!,
})

// List your assets
const { data: assets } = await client.assets.list()

// Generate AI insights for an asset
const { data: insights } = await client.assets.generateInsights(assets[0].id)

// Semantic search across your knowledge base
const { data: results } = await client.embeddings.search(
  'maintenance procedures for industrial equipment'
)

// Execute an AI agent
const { data: execution } = await client.agents.execute('agent_id', {
  prompt: 'Analyze Q3 maintenance needs and provide recommendations',
  asset_ids: assets.map(a => a.id),
})

console.log(execution.response)`

const methodColor: Record<string, string> = {
  GET: "border-emerald-500/60 text-emerald-400 bg-emerald-500/10",
  POST: "border-primary/60 text-primary bg-primary/10",
  PATCH: "border-amber-500/60 text-amber-400 bg-amber-500/10",
  DELETE: "border-destructive/60 text-destructive bg-destructive/10",
}

export default function ApiDocsPage() {
  return (
    <div className="min-h-screen bg-background relative overflow-x-hidden">
      {/* Tech grid background */}
      <div className="absolute inset-0 tech-grid opacity-30 pointer-events-none" />

      {/* Ambient glow orbs */}
      <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-primary/8 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/3 right-1/4 w-[400px] h-[400px] bg-accent/6 rounded-full blur-3xl pointer-events-none" />

      {/* ── Hero ── */}
      <div className="relative border-b border-border/40">
        <div className="absolute inset-0 enterprise-gradient opacity-60" />
        <div className="container mx-auto py-16 px-4 max-w-7xl relative z-10">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-10">
            <div className="space-y-5 max-w-2xl">
              <div className="flex items-center gap-3">
                <Badge className="status-indicator online text-xs px-3 py-1 font-mono">
                  v2.0 API
                </Badge>
                <Badge variant="outline" className="text-xs border-border/50 text-muted-foreground font-mono">
                  Free and open source - Apache 2.0
                </Badge>
              </div>
              <h1 className="text-5xl font-bold tracking-tight lg:text-6xl">
                <span className="enterprise-text-gradient">Build on Kronova</span>
              </h1>
              <p className="text-lg text-muted-foreground leading-relaxed">
                The free, open-source orchestration and intelligence platform for AI agents, workflows and
                real-world asset data. Use it as a sandbox and playground: explore the REST API, SDK and
                OpenAPI specification with no contract and no cost.
              </p>
              <div className="flex flex-wrap gap-3 pt-1">
                <Button asChild size="lg" className="enterprise-button">
                  <Link href="#playground">
                    <Play className="mr-2 h-4 w-4" />
                    Try in Playground
                  </Link>
                </Button>
                <Button variant="outline" size="lg" asChild className="border-border/60 hover:border-primary/50 hover:bg-primary/5 transition-all">
                  <Link href="/ai-suite/settings">
                    <Key className="mr-2 h-4 w-4" />
                    Get API Key
                  </Link>
                </Button>
                <Button variant="ghost" size="lg" asChild className="hover:bg-primary/5 transition-all">
                  <a
                    href="https://github.com/Kronova-Intelligent-Systems/asset-intel-orchestration-engine"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Code2 className="mr-2 h-4 w-4" />
                    View Source
                  </a>
                </Button>
              </div>
            </div>

            {/* Quick install card */}
            <div className="lg:w-[420px]">
              <div className="enterprise-card p-5 space-y-3">
                <div className="flex items-center gap-2 mb-1">
                  <Terminal className="h-4 w-4 text-primary" />
                  <span className="text-sm font-semibold text-foreground">Quick Install</span>
                </div>
                {Object.entries(SDK_INSTALL).map(([pkg, cmd]) => (
                  <div key={pkg} className="flex items-center gap-3">
                    <Badge variant="outline" className="w-12 justify-center text-xs font-mono border-border/50 text-muted-foreground">
                      {pkg}
                    </Badge>
                    <code className="flex-1 text-sm bg-muted/60 text-foreground px-3 py-1.5 rounded-md font-mono border border-border/30">
                      {cmd}
                    </code>
                  </div>
                ))}
                <div className="flex items-start gap-2 pt-2 border-t border-border/30">
                  <Radio className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    REST API base URL:{" "}
                    <code className="font-mono text-foreground">app.kronova.io/api/v1</code>. Edge Functions and
                    Supabase Auth are served from{" "}
                    <code className="font-mono text-foreground">api.kronova.io</code>.
                  </p>
                </div>
                <div className="flex items-start gap-2">
                  <Lock className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    AetherNet QUAS and KVS are an optional production layer, covered in the{" "}
                    <span className="text-foreground">AetherNet</span> tab.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-12">
            {[
              { value: `${TOTAL_OPERATIONS}`, label: "REST Operations" },
              { value: `${EDGE_FUNCTIONS.length}`, label: "Edge Functions" },
              { value: "Apache 2.0", label: "Open-Source License" },
              { value: "Free", label: "To Use and Self-Host" },
            ].map(({ value, label }) => (
              <div key={label} className="enterprise-card p-4 text-center">
                <div className="text-3xl font-bold enterprise-text-gradient">{value}</div>
                <p className="text-sm text-muted-foreground mt-1">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Main Content ── */}
      <div className="container mx-auto py-12 px-4 max-w-7xl relative z-10">
        <Tabs defaultValue="overview" className="space-y-8">
          <TabsList className="flex flex-wrap h-auto gap-1.5 bg-card/60 border border-border/40 p-1.5 rounded-xl backdrop-blur-sm w-fit">
            {[
              { value: "overview", icon: Book, label: "Overview" },
              { value: "playground", icon: Play, label: "Playground" },
              { value: "reference", icon: Code2, label: "Reference" },
              { value: "sdk", icon: FileJson, label: "SDK" },
              { value: "authentication", icon: Lock, label: "Auth" },
              { value: "edge-functions", icon: Server, label: "Edge Functions" },
              { value: "aethernet", icon: Shield, label: "AetherNet" },
            ].map(({ value, icon: Icon, label }) => (
              <TabsTrigger
                key={value}
                value={value}
                className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md transition-all duration-200 rounded-lg text-sm px-4"
              >
                <Icon className="mr-2 h-3.5 w-3.5" />
                {label}
              </TabsTrigger>
            ))}
          </TabsList>

          {/* ── Overview Tab ── */}
          <TabsContent value="overview" className="space-y-12">
            <PlatformOverview />

            <div>
              <h2 className="text-2xl font-bold mb-2">
                <span className="enterprise-text-gradient">API Categories</span>
              </h2>
              <p className="text-muted-foreground mb-6">
                {API_CATEGORIES.length} API surfaces covering every layer of the Kronova platform.
              </p>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {API_CATEGORIES.map((category) => (
                  <div key={category.id} className="enterprise-card group p-5 space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-gradient-to-br from-primary/20 to-accent/10 rounded-lg border border-primary/20">
                        <category.icon className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-foreground text-sm leading-tight">{category.name}</h3>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">{category.description}</p>
                    <div className="space-y-1.5">
                      {category.endpoints.slice(0, 4).map((endpoint, i) => (
                        <div key={i} className="flex items-center gap-2 text-xs">
                          <Badge
                            variant="outline"
                            className={`text-xs font-mono w-14 justify-center border ${methodColor[endpoint.method] ?? ""}`}
                          >
                            {endpoint.method}
                          </Badge>
                          <code className="text-muted-foreground truncate">{endpoint.path}</code>
                        </div>
                      ))}
                      {category.endpoints.length > 4 && (
                        <p className="text-xs text-muted-foreground/70 pl-1">
                          +{category.endpoints.length - 4} more
                        </p>
                      )}
                    </div>
                    <Button variant="ghost" className="w-full h-8 text-xs group-hover:text-primary group-hover:bg-primary/5 transition-colors" asChild>
                      <Link href={`#${category.id}`}>
                        View Documentation
                        <ArrowRight className="ml-1.5 h-3 w-3" />
                      </Link>
                    </Button>
                  </div>
                ))}
              </div>
            </div>

            {/* Quick Start */}
            <div>
              <h2 className="text-2xl font-bold mb-2">
                <span className="enterprise-text-gradient">Quick Start</span>
              </h2>
              <p className="text-muted-foreground mb-6">Get up and running in under 5 minutes.</p>
              <div className="enterprise-card overflow-hidden">
                <div className="flex items-center gap-2 px-5 py-3 border-b border-border/40 bg-muted/30">
                  <div className="flex gap-1.5">
                    <span className="w-3 h-3 rounded-full bg-destructive/60" />
                    <span className="w-3 h-3 rounded-full bg-amber-400/60" />
                    <span className="w-3 h-3 rounded-full bg-emerald-400/60" />
                  </div>
                  <span className="text-xs text-muted-foreground font-mono ml-2">quick-start.ts</span>
                </div>
                <pre className="bg-card/80 text-foreground p-5 text-sm overflow-x-auto leading-relaxed font-mono">
                  {QUICK_START_CODE}
                </pre>
              </div>
            </div>
          </TabsContent>

          {/* ── Playground Tab ── */}
          <TabsContent value="playground" id="playground" className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold mb-2">
                <span className="enterprise-text-gradient">API Playground</span>
              </h2>
              <p className="text-muted-foreground mb-6">
                Test API endpoints directly in your browser. Enter your API key to make live requests.
              </p>
            </div>
            <APIPlayground />
          </TabsContent>

          {/* ── Reference Tab ── */}
          <TabsContent value="reference" className="space-y-8">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold mb-1">
                  <span className="enterprise-text-gradient">API Reference</span>
                </h2>
                <p className="text-muted-foreground text-sm">Complete endpoint documentation for all API surfaces.</p>
              </div>
              <Button variant="outline" asChild className="border-border/60 hover:border-primary/50 hover:bg-primary/5 transition-all">
                <a href="/api/openapi.json" download>
                  <FileJson className="mr-2 h-4 w-4" />
                  OpenAPI Spec
                </a>
              </Button>
            </div>

            <ApiConventions />

            {API_CATEGORIES.map((category) => (
              <div key={category.id} id={category.id} className="enterprise-card overflow-hidden">
                <div className="flex items-center gap-3 px-5 py-4 border-b border-border/40 bg-muted/20">
                  <div className="p-1.5 bg-primary/15 rounded-md">
                    <category.icon className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground">{category.name}</h3>
                    <p className="text-xs text-muted-foreground">{category.description}</p>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border/30 bg-muted/10">
                        <th className="px-5 py-2.5 text-left text-xs font-medium text-muted-foreground w-20">Method</th>
                        <th className="px-5 py-2.5 text-left text-xs font-medium text-muted-foreground">Endpoint</th>
                        <th className="px-5 py-2.5 text-left text-xs font-medium text-muted-foreground">Description</th>
                      </tr>
                    </thead>
                    <tbody>
                      {category.endpoints.map((endpoint, i) => (
                        <tr key={i} className="border-b border-border/20 hover:bg-primary/3 transition-colors last:border-0">
                          <td className="px-5 py-3">
                            <Badge variant="outline" className={`font-mono text-xs border ${methodColor[endpoint.method] ?? ""}`}>
                              {endpoint.method}
                            </Badge>
                          </td>
                          <td className="px-5 py-3">
                            <code className="text-sm font-mono text-foreground/80">/api/v1{endpoint.path}</code>
                          </td>
                          <td className="px-5 py-3 text-muted-foreground text-sm">{endpoint.description}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </TabsContent>

          {/* ── SDK Tab ── */}
          <TabsContent value="sdk" className="space-y-8">
            <div>
              <h2 className="text-2xl font-bold mb-2">
                <span className="enterprise-text-gradient">Official SDK</span>
              </h2>
              <p className="text-muted-foreground">
                Type-safe access to all API endpoints with built-in retry logic, streaming support, and comprehensive TypeScript definitions.
                This SDK targets the platform API only. The post-quantum signing SDKs (aethernet-pqc-sdk 0.2.2 and
                kronova-sdk 0.4.1) are documented in the AetherNet tab.
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-5">
              <div className="enterprise-card p-5 space-y-4">
                <div>
                  <h3 className="font-semibold text-foreground">TypeScript / JavaScript</h3>
                  <p className="text-sm text-muted-foreground">Full-featured SDK for Node.js and browsers</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Installation</p>
                  <div className="enterprise-card overflow-hidden">
                    <div className="flex items-center gap-2 px-4 py-2 border-b border-border/40 bg-muted/30">
                      <Terminal className="h-3 w-3 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground font-mono">terminal</span>
                    </div>
                    <pre className="bg-card/80 text-foreground p-3 text-sm font-mono">npm install @kronova-intelligent-systems/sdk</pre>
                  </div>
                </div>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  {[
                    "Full TypeScript support with type definitions",
                    "Automatic retry with exponential backoff",
                    "Streaming responses for AI agents",
                    "Server-Sent Events for data streams",
                    "OAuth 2.1 PKCE helper utilities",
                  ].map((f) => (
                    <li key={f} className="flex items-start gap-2">
                      <CheckCircle2 className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="enterprise-card p-5 space-y-4">
                <div>
                  <h3 className="font-semibold text-foreground">Any language (REST + OpenAPI)</h3>
                  <p className="text-sm text-muted-foreground">Generate a typed client for Python, Go, Java, Rust and more</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Installation</p>
                  <div className="enterprise-card overflow-hidden">
                    <div className="flex items-center gap-2 px-4 py-2 border-b border-border/40 bg-muted/30">
                      <Terminal className="h-3 w-3 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground font-mono">terminal</span>
                    </div>
                    <pre className="bg-card/80 text-foreground p-3 text-sm font-mono">curl -O https://app.kronova.io/api/openapi.json</pre>
                  </div>
                </div>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  {[
                    "Works with openapi-generator, orval and openapi-typescript",
                    "Import straight into Postman or Insomnia",
                    "Same endpoints and scopes as the TypeScript SDK",
                    "Authenticate with a Bearer API key",
                  ].map((f) => (
                    <li key={f} className="flex items-start gap-2">
                      <CheckCircle2 className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
                <Badge variant="secondary" className="text-xs">Available now</Badge>
              </div>
            </div>

            {/* SDK Examples */}
            <div className="enterprise-card overflow-hidden">
              <div className="px-5 py-4 border-b border-border/40 bg-muted/20">
                <h3 className="font-semibold text-foreground">SDK Examples</h3>
              </div>
              <div className="p-5">
                <Tabs defaultValue="assets">
                  <TabsList className="bg-muted/50 border border-border/30 p-1 rounded-lg">
                    {["assets", "embeddings", "agents", "streams"].map((t) => (
                      <TabsTrigger key={t} value={t} className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground rounded-md text-sm capitalize transition-all">
                        {t === "streams" ? "Data Streams" : t.charAt(0).toUpperCase() + t.slice(1)}
                      </TabsTrigger>
                    ))}
                  </TabsList>
                  {[
                    {
                      value: "assets",
                      filename: "assets.ts",
                      code: `// Create an asset and generate AI insights
const { data: asset } = await client.assets.create({
  name: 'Industrial Robot Arm',
  type: 'equipment',
  acquisition_cost: 150000,
  metadata: {
    model: 'FANUC R-2000iC',
    serial: 'FR2000-12345'
  }
})

const { data: insights } = await client.assets.generateInsights(asset.id)
console.log(insights.recommendations)`,
                    },
                    {
                      value: "embeddings",
                      filename: "embeddings.ts",
                      code: `// Create embeddings and perform semantic search
await client.embeddings.create({
  content: 'Maintenance procedure for hydraulic systems...',
  dataset_id: 'ds_maintenance',
  metadata: { category: 'hydraulics', version: '2.0' }
})

const { data: results } = await client.embeddings.search(
  'how to maintain hydraulic pumps',
  { dataset_id: 'ds_maintenance', limit: 5 }
)

results.forEach(r => console.log(r.similarity, r.content))`,
                    },
                    {
                      value: "agents",
                      filename: "agents.ts",
                      code: `// Execute an AI agent with streaming
const stream = client.agents.executeStream('agt_analyzer', {
  prompt: 'Analyze all equipment maintenance patterns',
  asset_ids: ['ast_001', 'ast_002', 'ast_003']
})

for await (const chunk of stream) {
  process.stdout.write(chunk)
}`,
                    },
                    {
                      value: "streams",
                      filename: "data-streams.ts",
                      code: `// Subscribe to real-time IoT sensor data
const subscription = client.dataStreams.subscribe(
  { stream_type: 'iot-sensors' },
  {
    onMessage: (data) => {
      console.log('Sensor reading:', data)
      if (data.reading.temperature > 80) {
        triggerAlert(data.sensor_id)
      }
    },
    onError: (err) => console.error('Stream error:', err)
  }
)

// Later: subscription.close()`,
                    },
                  ].map(({ value, filename, code }) => (
                    <TabsContent key={value} value={value}>
                      <div className="enterprise-card overflow-hidden mt-4">
                        <div className="flex items-center gap-2 px-4 py-2 border-b border-border/40 bg-muted/30">
                          <div className="flex gap-1.5">
                            <span className="w-2.5 h-2.5 rounded-full bg-destructive/50" />
                            <span className="w-2.5 h-2.5 rounded-full bg-amber-400/50" />
                            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400/50" />
                          </div>
                          <span className="text-xs text-muted-foreground font-mono ml-1">{filename}</span>
                        </div>
                        <pre className="bg-card/80 text-foreground p-4 text-sm overflow-x-auto font-mono leading-relaxed">
                          {code}
                        </pre>
                      </div>
                    </TabsContent>
                  ))}
                </Tabs>
              </div>
            </div>
          </TabsContent>

          {/* ── AetherNet Tab ── */}
          <TabsContent value="aethernet">
            <AetherNetDocs />
          </TabsContent>

          {/* ── Authentication Tab ── */}
          <TabsContent value="authentication" className="space-y-8">
            <div>
              <h2 className="text-2xl font-bold mb-2">
                <span className="enterprise-text-gradient">Authentication</span>
              </h2>
              <p className="text-muted-foreground">
                Secure your API requests using API keys or OAuth 2.1 with PKCE for third-party integrations.
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-5">
              <div className="enterprise-card p-5 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary/15 rounded-lg">
                    <Key className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground">API Key Authentication</h3>
                    <p className="text-xs text-muted-foreground">Best for server-to-server integrations</p>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">Include your API key in the Authorization header:</p>
                <div className="enterprise-card overflow-hidden">
                  <pre className="bg-card/80 text-foreground p-3 text-sm font-mono">Authorization: Bearer sk_live_...</pre>
                </div>
                <div className="rounded-lg p-3 bg-amber-500/8 border border-amber-500/20">
                  <p className="text-sm font-semibold text-amber-400">Security Best Practices</p>
                  <ul className="text-sm text-muted-foreground mt-2 space-y-1.5">
                    {[
                      "Never expose API keys in client-side code",
                      "Use environment variables for storage",
                      "Rotate keys regularly",
                      "Use scoped keys with minimal permissions",
                    ].map((tip) => (
                      <li key={tip} className="flex items-start gap-2">
                        <Shield className="h-3.5 w-3.5 text-amber-400/70 mt-0.5 shrink-0" />
                        {tip}
                      </li>
                    ))}
                  </ul>
                </div>
                <Button asChild className="enterprise-button w-full">
                  <Link href="/ai-suite/settings">
                    Manage API Keys
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </div>

              <div className="enterprise-card p-5 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-accent/15 rounded-lg">
                    <Shield className="h-5 w-5 text-accent" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground">OAuth 2.1 with PKCE</h3>
                    <p className="text-xs text-muted-foreground">Best for third-party app integrations</p>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">OAuth 2.1 flow with Proof Key for Code Exchange (PKCE) for secure authorization:</p>
                <ol className="space-y-2.5 text-sm text-muted-foreground">
                  {[
                    "Generate code verifier and challenge",
                    "Redirect to /oauth/authorize",
                    "Exchange code for tokens at /oauth/token",
                    "Use access token for API requests",
                  ].map((step, i) => (
                    <li key={i} className="flex gap-3 items-start">
                      <span className="w-5 h-5 rounded-full bg-primary/20 text-primary text-xs flex items-center justify-center shrink-0 mt-0.5 font-bold">
                        {i + 1}
                      </span>
                      {step}
                    </li>
                  ))}
                </ol>
                <p className="text-xs text-muted-foreground border-l-2 border-primary/40 pl-3">
                  Compatible with Model Context Protocol (MCP) for AI integrations.
                </p>
                <Button variant="outline" asChild className="w-full border-border/60 hover:border-primary/50 hover:bg-primary/5 transition-all">
                  <Link href="/ai-suite/settings">
                    Manage OAuth Clients
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </div>

            {/* API Key Scopes */}
            <div className="enterprise-card p-5 space-y-4">
              <div>
                <h3 className="font-semibold text-foreground">API Key Scopes</h3>
                <p className="text-sm text-muted-foreground">
                  Choose scopes when you create a key. A request without the required scope returns 403 and names the
                  scope it needs. Stream endpoints accept an API key or a signed-in session.
                </p>
              </div>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-2.5">
                {[
                  { scope: "read:assets", description: "Read assets and data stores" },
                  { scope: "write:assets", description: "Create assets, data stores, insights" },
                  { scope: "read:embeddings", description: "Read and search embeddings" },
                  { scope: "write:embeddings", description: "Create and update embeddings" },
                  { scope: "delete:embeddings", description: "Delete embeddings" },
                  { scope: "read:datasets", description: "List datasets" },
                  { scope: "write:datasets", description: "Create datasets" },
                  { scope: "read:tokenization", description: "View tokens" },
                  { scope: "write:tokenization", description: "Tokenize and fractionalize" },
                  { scope: "stablecoins:read", description: "View stablecoins" },
                  { scope: "stablecoins:write", description: "Deploy, mint, burn, transfer" },
                  { scope: "read:agents", description: "Read agents, deployments, PQC keys" },
                  { scope: "write:agents", description: "Manage deployments and PQC keys" },
                  { scope: "execute:agents", description: "Execute AI agents" },
                  { scope: "execute:workflows", description: "Run workflows" },
                  { scope: "read:oauth", description: "List OAuth clients" },
                  { scope: "write:oauth", description: "Register OAuth clients" },
                  { scope: "voice:execute", description: "Create voice sessions" },
                ].map(({ scope, description }) => (
                  <div key={scope} className="flex items-center gap-2.5 p-2.5 rounded-lg border border-border/40 bg-muted/20 hover:border-primary/30 hover:bg-primary/5 transition-colors">
                    <Badge variant="outline" className="font-mono text-xs border-primary/30 text-primary bg-primary/5 shrink-0">
                      {scope}
                    </Badge>
                    <span className="text-xs text-muted-foreground">{description}</span>
                  </div>
                ))}
              </div>
            </div>
          </TabsContent>

          {/* ── Edge Functions Tab ── */}
          <TabsContent value="edge-functions" className="space-y-8">
            <div>
              <h2 className="text-2xl font-bold mb-2">
                <span className="enterprise-text-gradient">Supabase Edge Functions</span>
              </h2>
              <p className="text-muted-foreground">
                Serverless functions deployed on Supabase&apos;s global edge network for low-latency execution.
              </p>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {EDGE_FUNCTIONS.map((fn) => (
                <div key={fn.name} className="enterprise-card p-4 space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    <code className="text-sm font-semibold font-mono text-foreground">{fn.name}</code>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">{fn.description}</p>
                  <code className="text-xs text-muted-foreground/70 font-mono">/functions/v1/{fn.name}</code>
                </div>
              ))}
            </div>

            <div className="enterprise-card overflow-hidden">
              <div className="px-5 py-3 border-b border-border/40 bg-muted/20">
                <h3 className="font-semibold text-foreground text-sm">Invoking Edge Functions</h3>
              </div>
              <div className="enterprise-card m-4 overflow-hidden">
                <div className="flex items-center gap-2 px-4 py-2 border-b border-border/40 bg-muted/30">
                  <div className="flex gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-destructive/50" />
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-400/50" />
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400/50" />
                  </div>
                  <span className="text-xs text-muted-foreground font-mono ml-1">edge-invoke.ts</span>
                </div>
                <pre className="bg-card/80 text-foreground p-4 text-sm overflow-x-auto font-mono leading-relaxed">
                  {`// Using Supabase client
const { data, error } = await supabase.functions.invoke('execute-agent', {
  body: {
    agentId: 'agt_xyz123',
    prompt: 'Analyze maintenance schedules',
    assetIds: ['ast_001', 'ast_002']
  }
})

// Using fetch directly
const response = await fetch(
  'https://api.kronova.io/functions/v1/execute-agent',
  {
    method: 'POST',
    headers: {
      'Authorization': \`Bearer \${accessToken}\`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      agentId: 'agt_xyz123',
      prompt: 'Analyze maintenance schedules'
    })
  }
)`}
                </pre>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* ── Footer CTA ── */}
      <div className="relative border-t border-border/40 mt-8">
        <div className="absolute inset-0 enterprise-gradient opacity-50" />
        <div className="container mx-auto py-14 px-4 max-w-7xl relative z-10">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div>
              <h3 className="text-2xl font-bold enterprise-text-gradient">Ready to get started?</h3>
              <p className="text-muted-foreground mt-1">Create a free API key and start building. The platform is open source and free for everyone.</p>
            </div>
            <div className="flex gap-3">
              <Button asChild className="enterprise-button">
                <Link href="/ai-suite/settings">
                  <Key className="mr-2 h-4 w-4" />
                  Get API Key
                </Link>
              </Button>
              <Button variant="outline" asChild className="border-border/60 hover:border-primary/50 hover:bg-primary/5 transition-all">
                <Link href="/support">Ask Kairo</Link>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
