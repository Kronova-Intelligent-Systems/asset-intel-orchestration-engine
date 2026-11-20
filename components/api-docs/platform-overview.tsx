import Link from "next/link"
import {
  ArrowRight,
  Bot,
  CheckCircle2,
  Database,
  FlaskConical,
  GitFork,
  Github,
  Mic,
  Radio,
  Scale,
  Sparkles,
  Terminal,
  Workflow,
  Heart,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

const REPO_URL = "https://github.com/Kronova-Intelligent-Systems/asset-intel-orchestration-engine"

const PILLARS = [
  {
    icon: Heart,
    title: "Free for anyone",
    body: "No contract, no sales call, no credit card. Sign up, create an API key and start building. Run it on the hosted app or on your own infrastructure.",
  },
  {
    icon: Scale,
    title: "Open source, Apache 2.0",
    body: "The orchestration and intelligence platform is licensed under Apache 2.0. Read it, fork it, self-host it, and ship it inside your own products.",
  },
  {
    icon: FlaskConical,
    title: "A sandbox and playground",
    body: "Treat the platform as a large playground for developers. Create assets, run agents, wire up workflows and test every endpoint without risk.",
  },
]

const CAPABILITIES = [
  {
    icon: Bot,
    title: "Orchestration",
    items: ["AI agents that call tools against your data", "Multi-step workflows that chain agents and actions", "Agent2Agent (A2A) protocol endpoint"],
  },
  {
    icon: Sparkles,
    title: "Intelligence",
    items: ["AI-generated insights per asset", "Vector embeddings and semantic search", "Datasets for retrieval-augmented generation"],
  },
  {
    icon: Database,
    title: "Asset data",
    items: ["44-field real-world asset schema", "Managed data stores and data sources", "Tokenization and private stablecoin flows"],
  },
  {
    icon: Radio,
    title: "Live data",
    items: ["Server-Sent Events for agents and workflows", "IoT sensor streams", "Webhook delivery for platform events"],
  },
  {
    icon: Mic,
    title: "Interfaces",
    items: ["Voice sessions with speech-to-text and text-to-speech", "OAuth 2.1 with PKCE", "Model Context Protocol (MCP) compatible clients"],
  },
  {
    icon: Workflow,
    title: "Integrations",
    items: ["TypeScript SDK and any-language REST access", "OpenAPI 3.0 specification", "Supabase Edge Functions for heavy lifting"],
  },
]

const HOSTED_STEPS = [
  { title: "Create an account", body: "Sign up at app.kronova.io. It is free." },
  { title: "Create an API key", body: "Open Settings, choose the scopes you need and copy the key. It is shown once." },
  { title: "Call the API", body: "Send the key as a Bearer token to app.kronova.io/api/v1, or use the Playground tab." },
]

const SELF_HOST_CODE = `git clone ${REPO_URL}.git
cd asset-intel-orchestration-engine
pnpm install
cp .env.example .env.local
pnpm dev`

export function PlatformOverview() {
  return (
    <section aria-labelledby="platform-heading" className="space-y-8">
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge className="text-xs font-mono">Open source</Badge>
          <Badge variant="outline" className="text-xs font-mono border-border/50 text-muted-foreground">
            Apache 2.0
          </Badge>
          <Badge variant="outline" className="text-xs font-mono border-border/50 text-muted-foreground">
            Free to use
          </Badge>
        </div>
        <h2 id="platform-heading" className="text-2xl font-bold">
          <span className="enterprise-text-gradient">The free orchestration and intelligence platform</span>
        </h2>
        <p className="text-muted-foreground leading-relaxed max-w-3xl">
          Kronova is an open-source platform for orchestrating AI agents and workflows over real-world asset data. It is
          free for anyone to use, and it is built to be a sandbox: a large playground where developers can learn,
          prototype and ship, using the same REST API, SDK and tools that the product itself runs on.
        </p>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        {PILLARS.map(({ icon: Icon, title, body }) => (
          <div key={title} className="enterprise-card p-5 space-y-3">
            <div className="p-2 w-fit bg-gradient-to-br from-primary/20 to-accent/10 rounded-lg border border-primary/20">
              <Icon className="h-5 w-5 text-primary" aria-hidden="true" />
            </div>
            <h3 className="font-semibold text-foreground">{title}</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">{body}</p>
          </div>
        ))}
      </div>

      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-foreground">What you can build with it</h3>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {CAPABILITIES.map(({ icon: Icon, title, items }) => (
            <div key={title} className="enterprise-card p-5 space-y-3">
              <div className="flex items-center gap-2.5">
                <Icon className="h-4 w-4 text-primary" aria-hidden="true" />
                <h4 className="font-semibold text-sm text-foreground">{title}</h4>
              </div>
              <ul className="space-y-1.5">
                {items.map((item) => (
                  <li key={item} className="flex items-start gap-2 text-xs text-muted-foreground leading-relaxed">
                    <CheckCircle2 className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" aria-hidden="true" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-foreground">Two ways to start</h3>
        <div className="grid lg:grid-cols-2 gap-4">
          <div className="enterprise-card p-5 space-y-4">
            <div>
              <h4 className="font-semibold text-foreground">Use the hosted platform</h4>
              <p className="text-sm text-muted-foreground">The fastest path. Nothing to install.</p>
            </div>
            <ol className="space-y-3">
              {HOSTED_STEPS.map((step, i) => (
                <li key={step.title} className="flex gap-3 items-start">
                  <span className="w-6 h-6 rounded-full bg-primary/20 text-primary text-xs flex items-center justify-center shrink-0 mt-0.5 font-bold">
                    {i + 1}
                  </span>
                  <div>
                    <p className="text-sm font-medium text-foreground">{step.title}</p>
                    <p className="text-xs text-muted-foreground leading-relaxed">{step.body}</p>
                  </div>
                </li>
              ))}
            </ol>
            <div className="flex flex-wrap gap-2 pt-1">
              <Button asChild size="sm" className="enterprise-button">
                <Link href="/signup">
                  Create a free account
                  <ArrowRight className="ml-2 h-3.5 w-3.5" aria-hidden="true" />
                </Link>
              </Button>
              <Button asChild size="sm" variant="outline" className="border-border/60">
                <Link href="/ai-suite/settings">Get API Key</Link>
              </Button>
            </div>
          </div>

          <div className="enterprise-card p-5 space-y-4">
            <div>
              <h4 className="font-semibold text-foreground">Run it yourself</h4>
              <p className="text-sm text-muted-foreground">
                Clone the repository and run the whole platform locally. Settlement flows fall back to open-source
                stand-ins, so nothing else is required to experiment.
              </p>
            </div>
            <div className="enterprise-card overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-2 border-b border-border/40 bg-muted/30">
                <Terminal className="h-3 w-3 text-muted-foreground" aria-hidden="true" />
                <span className="text-xs text-muted-foreground font-mono">terminal</span>
              </div>
              <pre className="bg-card/80 text-foreground p-4 text-xs sm:text-sm font-mono overflow-x-auto leading-relaxed">
                {SELF_HOST_CODE}
              </pre>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Fill in the keys in <code className="font-mono text-foreground">.env.local</code> for the services you
              want to use. See the repository README for the full list.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button asChild size="sm" variant="outline" className="border-border/60">
                <a href={REPO_URL} target="_blank" rel="noopener noreferrer">
                  <Github className="mr-2 h-3.5 w-3.5" aria-hidden="true" />
                  View on GitHub
                </a>
              </Button>
              <Button asChild size="sm" variant="outline" className="border-border/60">
                <a href={`${REPO_URL}/fork`} target="_blank" rel="noopener noreferrer">
                  <GitFork className="mr-2 h-3.5 w-3.5" aria-hidden="true" />
                  Fork
                </a>
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="enterprise-card p-5 flex flex-col md:flex-row md:items-center gap-4 justify-between">
        <div className="space-y-1 max-w-3xl">
          <h3 className="font-semibold text-foreground">Contributing and support</h3>
          <p className="text-sm text-muted-foreground leading-relaxed">
            This is a community-friendly open-source project, maintained on a best-effort basis. Documentation is kept in
            step with the code: if an endpoint or a page here does not match what you see, open an issue or a pull request
            and we will fix it. AetherNet QUAS and KVS are an optional, separate production layer, covered in the AetherNet
            tab.
          </p>
        </div>
        <Button asChild variant="outline" size="sm" className="border-border/60 shrink-0">
          <a href={`${REPO_URL}/issues`} target="_blank" rel="noopener noreferrer">
            Open an issue
            <ArrowRight className="ml-2 h-3.5 w-3.5" aria-hidden="true" />
          </a>
        </Button>
      </div>
    </section>
  )
}
