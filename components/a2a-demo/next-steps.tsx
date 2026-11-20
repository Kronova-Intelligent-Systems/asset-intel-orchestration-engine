import Link from "next/link"
import { ArrowUpRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { PILOT } from "@/lib/pilot/config"

const BUILT_IN = [
  { label: "Build agents", href: "/ai-suite/agents" },
  { label: "Orchestrate workflows", href: "/ai-suite/workflows" },
  { label: "Search embeddings", href: "/ai-suite/embeddings" },
  { label: "Tokenize assets", href: "/ai-suite/tokenization" },
  { label: "Connect IoT devices", href: "/ai-suite/iot" },
  { label: "Manage AetherNet keys", href: "/ai-suite/aethernet" },
]

export function NextSteps() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Where to go from here</CardTitle>
        <CardDescription>
          Keep building with the agents, workflows, embeddings, tokenization and IoT tools in this suite. When you are ready for institutional scale, the Kronova team can walk you through an AetherNet QUAS and KVS enterprise pilot.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <nav aria-label="Built-in capabilities" className="flex flex-wrap gap-2">
            {BUILT_IN.map((link) => (
              <Button key={link.href} asChild variant="outline" size="sm">
                <Link href={link.href}>{link.label}</Link>
              </Button>
            ))}
          </nav>
          <Button asChild>
            <a href={PILOT.url} target="_blank" rel="noopener noreferrer">
              Explore the enterprise pilot
              <ArrowUpRight className="ml-2 h-4 w-4" aria-hidden="true" />
            </a>
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
