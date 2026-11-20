"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Network,
  Shield,
  Bot,
  Activity,
  Lock,
  Key,
  Zap,
  TrendingUp,
  CheckCircle2,
  ExternalLink,
  Code,
  Layers,
  ArrowRight,
  Database,
  FlaskConical,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { OAuthClientManager } from "./oauth-client-manager"
import { MCPAgentConfigurator } from "./mcp-agent-configurator"
import { AetherNetMonitor } from "./aethernet-monitor"
import { OAuthAgentAnalytics } from "./oauth-agent-analytics"

interface AetherNetOAuthMCPDashboardProps {
  user: any
  oauthClients: any[]
  oauthAgents: any[]
  aethernetConnections: any[]
  executionStats: any[]
  aethernetMessages: any[]
}

export function AetherNetOAuthMCPDashboard({
  user,
  oauthClients,
  oauthAgents,
  aethernetConnections,
  executionStats,
  aethernetMessages,
}: AetherNetOAuthMCPDashboardProps) {
  const [selectedTab, setSelectedTab] = useState("overview")

  // Calculate metrics
  const activeOAuthClients = oauthClients.filter((c) => c.is_active).length
  const totalAgents = oauthAgents.length
  const activeConnections = aethernetConnections.filter((c) => c.connection_status === "connected").length
  const successRate =
    executionStats.length > 0
      ? (executionStats.filter((s) => s.status === "success").length / executionStats.length) * 100
      : 0

  const benefits = [
    {
      title: "OAuth 2.1 — Read-Only Orchestration Only",
      description: "OAuth 2.1 with PKCE is strictly scoped to read-only frontend orchestration: agent discovery, context retrieval, and UI state. Bearer tokens are never used for execution or settlement. Relying on classical OAuth bearer tokens for execution would inject unacceptable cryptographic vulnerabilities into a zero-trust system.",
      icon: Shield,
      color: "text-blue-500",
      bgColor: "bg-blue-500/10",
    },
    {
      title: "AetherNet Cryptographic Airgap",
      description: "All execution mandates, settlement instructions, and agent-to-agent contracts bypass OAuth entirely and route directly through the AetherNet Cryptographic Airgap. Each mandate is signed with post-quantum signatures — no bearer token is issued, no classical cryptographic surface is exposed.",
      icon: Lock,
      color: "text-pink-500",
      bgColor: "bg-pink-500/10",
    },
    {
      title: "AetherNet QUAS — Canton Settlement Layer",
      description: "AetherNet QUAS (Quantum Universal Agentic Substrate) executes legally binding machine-to-machine financial contracts inside Trusted Execution Environments (TEEs) on the Canton Network. QUAS is architecturally independent of OAuth — it is not an extension of it.",
      icon: Network,
      color: "text-purple-500",
      bgColor: "bg-purple-500/10",
    },
    {
      title: "AetherNet KVS — Distributed Agent State",
      description: "AetherNet KVS (Key-Value Store) persists distributed agent state, workflow checkpoints, and execution context across the settlement network. KVS reads and writes are authorized via post-quantum signatures through the Airgap, never via OAuth bearer tokens.",
      icon: Database,
      color: "text-green-500",
      bgColor: "bg-green-500/10",
    },
  ]

  const features = [
    {
      category: "OAuth 2.1 — Read-Only Only",
      categoryNote: "No execution scopes",
      items: [
        "Authorization Code + PKCE flow",
        "Dynamic client registration",
        "Refresh token rotation",
        "Scopes: read_agents, read_assets only",
        "Client credential management",
        "Token revocation & lifecycle",
      ],
    },
    {
      category: "MCP — Read Orchestration",
      categoryNote: "Context reads, not writes",
      items: [
        "Standard OAuth discovery endpoint",
        "Third-party app context reads",
        "Scoped read-only API access",
        "Webhook event delivery (read)",
        "Rate limiting & quota management",
        "Audit logging & compliance",
      ],
    },
    {
      category: "AetherNet QUAS + KVS",
      categoryNote: "Bypasses OAuth entirely",
      items: [
        "Cryptographic Airgap — no bearer tokens",
        "FIPS 204 ML-DSA-65 post-quantum signing",
        "Canton Network settlement (TEEs)",
        "QUAS: legally binding M2M contracts",
        "KVS: distributed agent state & checkpoints",
        "MEV-resistant transaction ordering",
      ],
    },
  ]

  return (
    <div className="container mx-auto p-4 sm:p-6 max-w-7xl space-y-8">
      {/* Header */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="p-4 rounded-2xl bg-gradient-to-br from-pink-500/20 via-purple-500/20 to-blue-500/20 backdrop-blur-sm border border-primary/20">
              <Network className="h-8 w-8 text-primary" />
            </div>
            <div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-pink-500 via-purple-500 to-blue-500 bg-clip-text text-transparent">
                AetherNet QUAS
              </h1>
              <p className="text-muted-foreground mt-1">
                Quantum-Unified Agent Settlement — read-only orchestration via OAuth 2.1 MCP, execution via AetherNet Cryptographic Airgap
              </p>
            </div>
          </div>
          <Badge
            variant="outline"
            className="h-8 px-4 bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20"
          >
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse mr-2" />
            Production Ready
          </Badge>
        </div>

        {/* Overview Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card className="enterprise-card">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">OAuth Clients</p>
                  <p className="text-3xl font-bold">{activeOAuthClients}</p>
                  <p className="text-xs text-muted-foreground mt-1">Active</p>
                </div>
                <div className="p-3 rounded-xl bg-blue-500/10">
                  <Key className="h-6 w-6 text-blue-500" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="enterprise-card">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">MCP Agents</p>
                  <p className="text-3xl font-bold">{totalAgents}</p>
                  <p className="text-xs text-muted-foreground mt-1">Configured</p>
                </div>
                <div className="p-3 rounded-xl bg-purple-500/10">
                  <Bot className="h-6 w-6 text-purple-500" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="enterprise-card">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">AetherNet QUAS</p>
                  <p className="text-3xl font-bold">{activeConnections}</p>
                  <p className="text-xs text-muted-foreground mt-1">Connected</p>
                </div>
                <div className="p-3 rounded-xl bg-pink-500/10">
                  <Network className="h-6 w-6 text-pink-500" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="enterprise-card">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Success Rate</p>
                  <p className="text-3xl font-bold">{successRate.toFixed(1)}%</p>
                  <p className="text-xs text-muted-foreground mt-1">Last 30 days</p>
                </div>
                <div className="p-3 rounded-xl bg-green-500/10">
                  <TrendingUp className="h-6 w-6 text-green-500" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <Tabs value={selectedTab} onValueChange={setSelectedTab} className="space-y-6">
        <div className="overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0">
          <TabsList className="inline-flex md:grid w-full md:grid-cols-5 min-w-max md:min-w-0">
            <TabsTrigger value="overview" className="flex items-center gap-2 whitespace-nowrap">
              <Zap className="h-4 w-4 shrink-0" />
              <span className="hidden sm:inline">Overview</span>
            </TabsTrigger>
            <TabsTrigger value="oauth" className="flex items-center gap-2 whitespace-nowrap">
              <Key className="h-4 w-4 shrink-0" />
              <span className="hidden sm:inline">OAuth</span>
              <span className="sm:hidden">OAuth</span>
            </TabsTrigger>
            <TabsTrigger value="agents" className="flex items-center gap-2 whitespace-nowrap">
              <Bot className="h-4 w-4 shrink-0" />
              <span className="hidden sm:inline">MCP Agents</span>
              <span className="sm:hidden">Agents</span>
            </TabsTrigger>
            <TabsTrigger value="aethernet" className="flex items-center gap-2 whitespace-nowrap opacity-50" disabled>
              <Network className="h-4 w-4 shrink-0" />
              <span>AetherNet QUAS</span>
              <Badge variant="outline" className="ml-1 text-[10px] px-1.5 py-0 h-4 border-amber-500/50 text-amber-600 dark:text-amber-400">Pilot</Badge>
            </TabsTrigger>
            <TabsTrigger value="analytics" className="flex items-center gap-2 whitespace-nowrap">
              <Activity className="h-4 w-4 shrink-0" />
              <span>Analytics</span>
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          {/* Architecture — Two Separate Tracks */}
          <Card className="enterprise-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Code className="h-5 w-5 text-primary" />
                Two-Track Architecture
              </CardTitle>
              <CardDescription>
                OAuth 2.1 and AetherNet QUAS are architecturally separate. OAuth is strictly read-only. All execution bypasses OAuth entirely.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-8">

              {/* Critical notice */}
              <div className="flex gap-3 p-4 rounded-xl border border-destructive/30 bg-destructive/5">
                <Lock className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
                <p className="text-sm text-muted-foreground">
                  <span className="font-semibold text-foreground">Important: </span>
                  OAuth 2.1 bearer tokens must never be used to authorize execution, settlement, or agent mandates. Doing so would inject classical cryptographic vulnerabilities into a zero-trust system. All execution routes through the AetherNet Cryptographic Airgap exclusively.
                </p>
              </div>

              <div className="grid gap-8 md:grid-cols-2">
                {/* Track A — OAuth Read-Only */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2 pb-2 border-b border-blue-500/20">
                    <div className="p-1.5 rounded-lg bg-blue-500/10">
                      <Key className="h-4 w-4 text-blue-500" />
                    </div>
                    <h4 className="font-semibold text-blue-600 dark:text-blue-400">Track A — OAuth 2.1 (Read-Only Orchestration)</h4>
                  </div>
                  <div className="space-y-4">
                    <div className="flex gap-3">
                      <div className="w-7 h-7 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-500 text-xs font-bold shrink-0">1</div>
                      <div>
                        <p className="text-sm font-medium mb-1">OAuth Client Registration</p>
                        <p className="text-xs text-muted-foreground">Register a client with scopes strictly limited to read operations: agent discovery, context retrieval, and UI state. No execution scopes are issued.</p>
                        <div className="bg-muted/50 rounded-lg p-3 text-xs font-mono mt-2">
                          <code>POST /oauth/register</code>
                          <div className="mt-1 text-muted-foreground">{`"scopes": ["read_agents", "read_assets"]`}</div>
                        </div>
                      </div>
                    </div>
                    <ArrowRight className="h-4 w-4 text-blue-400/50 mx-auto" />
                    <div className="flex gap-3">
                      <div className="w-7 h-7 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-500 text-xs font-bold shrink-0">2</div>
                      <div>
                        <p className="text-sm font-medium mb-1">Authorization Code + PKCE</p>
                        <p className="text-xs text-muted-foreground">Issue a bearer token scoped to read-only MCP operations. Token authorizes the frontend to read context — nothing more.</p>
                        <div className="bg-muted/50 rounded-lg p-3 text-xs font-mono mt-2">
                          <code>GET /oauth/authorize?code_challenge=...</code>
                        </div>
                      </div>
                    </div>
                    <ArrowRight className="h-4 w-4 text-blue-400/50 mx-auto" />
                    <div className="flex gap-3">
                      <div className="w-7 h-7 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-500 text-xs font-bold shrink-0">3</div>
                      <div>
                        <p className="text-sm font-medium mb-1">MCP Agent Context (Read)</p>
                        <p className="text-xs text-muted-foreground">The OAuth token authorizes MCP context reads only. When an agent determines execution is required, it does not extend the OAuth token — it drops to Track B.</p>
                        <div className="bg-muted/50 rounded-lg p-3 text-xs font-mono mt-2">
                          <code>GET /mcp/context — read only</code>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Track B — QUAS Execution */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2 pb-2 border-b border-pink-500/20">
                    <div className="p-1.5 rounded-lg bg-pink-500/10">
                      <Network className="h-4 w-4 text-pink-500" />
                    </div>
                    <h4 className="font-semibold text-pink-600 dark:text-pink-400">Track B — AetherNet QUAS (Execution, Settlement, Mandates)</h4>
                  </div>
                  <div className="space-y-4">
                    <div className="flex gap-3">
                      <div className="w-7 h-7 rounded-full bg-pink-500/20 flex items-center justify-center text-pink-500 text-xs font-bold shrink-0">1</div>
                      <div>
                        <p className="text-sm font-medium mb-1">Cryptographic Airgap — No OAuth</p>
                        <p className="text-xs text-muted-foreground">Execution mandates bypass OAuth entirely. The agent signs the mandate with a post-quantum key (FIPS 204 ML-DSA-65) and submits it through the AetherNet edge gateway to the Airgap. No bearer token is issued or accepted.</p>
                        <div className="bg-muted/50 rounded-lg p-3 text-xs font-mono mt-2">
                          <code>Mandate signed: ML-DSA-65 (FIPS 204)</code>
                          <div className="mt-1 text-muted-foreground">Zero OAuth surface — airgapped execution</div>
                        </div>
                      </div>
                    </div>
                    <ArrowRight className="h-4 w-4 text-pink-400/50 mx-auto" />
                    <div className="flex gap-3">
                      <div className="w-7 h-7 rounded-full bg-pink-500/20 flex items-center justify-center text-pink-500 text-xs font-bold shrink-0">2</div>
                      <div>
                        <p className="text-sm font-medium mb-1">QUAS Settlement in TEE</p>
                        <p className="text-xs text-muted-foreground">AetherNet QUAS executes the signed mandate inside a Trusted Execution Environment on the Canton Network. Legally binding machine-to-machine contracts settle here — never on a bearer-token-authenticated surface.</p>
                        <div className="bg-muted/50 rounded-lg p-3 text-xs font-mono mt-2">
                          <code>QUAS TEE: Canton settlement layer</code>
                        </div>
                      </div>
                    </div>
                    <ArrowRight className="h-4 w-4 text-pink-400/50 mx-auto" />
                    <div className="flex gap-3">
                      <div className="w-7 h-7 rounded-full bg-pink-500/20 flex items-center justify-center text-pink-500 text-xs font-bold shrink-0">3</div>
                      <div>
                        <p className="text-sm font-medium mb-1">KVS State Persistence</p>
                        <p className="text-xs text-muted-foreground">AetherNet KVS persists execution state, workflow checkpoints, and settlement receipts. KVS access is authorized by post-quantum signatures through the Airgap — never via OAuth bearer tokens.</p>
                        <div className="bg-muted/50 rounded-lg p-3 text-xs font-mono mt-2">
                          <code>KVS.write(checkpoint, pq_sig)</code>
                          <div className="mt-1 text-muted-foreground">
                            Enterprise Pilot only —{" "}
                            <a href="https://kronova.io/enterprise-pilot" target="_blank" rel="noreferrer" className="underline text-primary">
                              Apply here
                            </a>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Benefits */}
          <Card className="enterprise-card">
            <CardHeader>
              <CardTitle>Architecture: Two Isolated Security Domains</CardTitle>
              <CardDescription>
                OAuth 2.1 and AetherNet QUAS operate in strict isolation. Classical bearer-token cryptography is confined to read-only orchestration. Post-quantum signing governs all execution.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2">
                {benefits.map((benefit, idx) => {
                  const Icon = benefit.icon
                  return (
                    <div key={idx} className="flex gap-4 p-4 rounded-xl border border-border/50 bg-card/50">
                      <div className={cn("p-3 rounded-lg shrink-0", benefit.bgColor)}>
                        <Icon className={cn("h-5 w-5", benefit.color)} />
                      </div>
                      <div className="flex-1">
                        <h4 className="font-semibold mb-1">{benefit.title}</h4>
                        <p className="text-sm text-muted-foreground">{benefit.description}</p>
                      </div>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>

          {/* Features Matrix */}
          <Card className="enterprise-card">
            <CardHeader>
              <CardTitle>Complete Feature Set</CardTitle>
              <CardDescription>Comprehensive capabilities across OAuth 2.1, MCP, and AetherNet QUAS + KVS</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-6 md:grid-cols-3">
                {features.map((feature, idx) => (
                  <div key={idx} className="space-y-3">
                    <div>
                      <h4 className="font-semibold text-sm text-primary">{feature.category}</h4>
                      {feature.categoryNote && (
                        <p className="text-xs text-muted-foreground mt-0.5">{feature.categoryNote}</p>
                      )}
                    </div>
                    <ul className="space-y-2">
                      {feature.items.map((item, itemIdx) => (
                        <li key={itemIdx} className="flex items-start gap-2 text-sm">
                          <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />
                          <span className="text-muted-foreground">{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Quick Start */}
          <Card className="enterprise-card border-primary/50">
            <CardHeader>
              <CardTitle>Quick Start Guide</CardTitle>
              <CardDescription>Get started with OAuth 2.1 MCP agents in minutes</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 md:grid-cols-2">
                <Button className="h-auto py-4 flex-col items-start gap-2" onClick={() => setSelectedTab("oauth")}>
                  <div className="flex items-center gap-2 w-full">
                    <Key className="h-4 w-4" />
                    <span className="font-semibold">Create OAuth Client</span>
                  </div>
                  <span className="text-xs text-left opacity-80">Register a new OAuth 2.1 client</span>
                </Button>

                <Button
                  className="h-auto py-4 flex-col items-start gap-2 bg-transparent"
                  variant="outline"
                  onClick={() => setSelectedTab("agents")}
                >
                  <div className="flex items-center gap-2 w-full">
                    <Bot className="h-4 w-4" />
                    <span className="font-semibold">Configure Agent</span>
                  </div>
                  <span className="text-xs text-left opacity-80">Link OAuth client to AI agent</span>
                </Button>

                <Button
                  className="h-auto py-4 flex-col items-start gap-2 bg-transparent opacity-60"
                  variant="outline"
                  asChild
                >
                  <a href="https://kronova.io/enterprise-pilot" target="_blank" rel="noreferrer">
                    <div className="flex items-center gap-2 w-full">
                      <Network className="h-4 w-4" />
                      <span className="font-semibold">AetherNet QUAS API Key</span>
                    </div>
                    <span className="text-xs text-left opacity-80">Apply for Enterprise Pilot access</span>
                  </a>
                </Button>

                <Button className="h-auto py-4 flex-col items-start gap-2 bg-transparent" variant="outline" asChild>
                  <a href="/docs" target="_blank" rel="noreferrer">
                    <div className="flex items-center gap-2 w-full">
                      <ExternalLink className="h-4 w-4" />
                      <span className="font-semibold">API Documentation</span>
                    </div>
                    <span className="text-xs text-left opacity-80">View complete API reference</span>
                  </a>
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* OAuth Clients Tab */}
        <TabsContent value="oauth" className="space-y-6">
          <OAuthClientManager clients={oauthClients} userId={user.id} />
        </TabsContent>

        {/* MCP Agents Tab */}
        <TabsContent value="agents" className="space-y-6">
          <MCPAgentConfigurator agents={oauthAgents} oauthClients={oauthClients} userId={user.id} />
        </TabsContent>

        {/* AetherNet QUAS Tab — access gated behind Enterprise Pilot */}
        <TabsContent value="aethernet" className="space-y-6">
          <div className="relative rounded-2xl overflow-hidden">
            {/* Grayed-out preview of the monitor */}
            <div className="opacity-25 pointer-events-none select-none" aria-hidden="true">
              <AetherNetMonitor connections={[]} messages={[]} userId={user.id} />
            </div>

            {/* Overlay */}
            <div className="absolute inset-0 flex items-center justify-center bg-background/60 backdrop-blur-sm">
              <Card className="max-w-lg w-full mx-6 border-amber-500/30 shadow-2xl">
                <CardHeader className="text-center pb-4">
                  <div className="mx-auto mb-4 p-4 rounded-2xl bg-amber-500/10 w-fit">
                    <FlaskConical className="h-8 w-8 text-amber-500" />
                  </div>
                  <CardTitle className="text-2xl">AetherNet QUAS &amp; KVS</CardTitle>
                  <CardDescription className="text-base">
                    Canton-secured settlement, post-quantum signing, and distributed KVS agent state are available exclusively through the AetherNet Enterprise Pilot Program.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-3">
                    {[
                      "Dedicated API keys for the AetherNet Canton settlement layer",
                      "AetherNet KVS: distributed key-value store for agent state &amp; checkpointing",
                      "Custom K8s/Docker deployment configurations",
                      "Direct engineering support for your compliance engine integration",
                    ].map((item, i) => (
                      <div key={i} className="flex items-start gap-3 text-sm">
                        <CheckCircle2 className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                        <span className="text-muted-foreground" dangerouslySetInnerHTML={{ __html: item }} />
                      </div>
                    ))}
                  </div>
                  <Button className="w-full bg-amber-500 hover:bg-amber-600 text-white font-semibold" asChild>
                    <a href="https://kronova.io/enterprise-pilot" target="_blank" rel="noreferrer">
                      <ExternalLink className="h-4 w-4 mr-2" />
                      Apply for the Enterprise Pilot Program
                    </a>
                  </Button>
                  <p className="text-xs text-center text-muted-foreground">
                    We are currently onboarding a select group of institutional partners.
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* Analytics Tab */}
        <TabsContent value="analytics" className="space-y-6">
          <OAuthAgentAnalytics
            executionStats={executionStats}
            agents={oauthAgents}
            messages={aethernetMessages}
            connections={aethernetConnections}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}
