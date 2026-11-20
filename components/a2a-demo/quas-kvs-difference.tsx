import { ArrowUpRight, Cpu, Database, Landmark } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

interface Difference {
  topic: string
  demo: string
  enterprise: string
}

const QUAS: Difference[] = [
  {
    topic: "Where keys and plaintext live",
    demo: "In this app's server process. Keys are generated for each run and held in application memory, so whoever operates the server could read them.",
    enterprise:
      "Inside a bare-metal Rust trusted execution environment. The ML-KEM envelope is opened in isolated RAM, and keys cannot be extracted by the host OS, an operator or a searcher.",
  },
  {
    topic: "Who you have to trust",
    demo: "The code on this server. The policy check is deterministic and involves no LLM, but nothing proves to a counterparty that the code you ran is the code they expect.",
    enterprise:
      "The silicon. Hardware-rooted attestation verifies the chip and the code integrity, so a counterparty can check what is enforcing the mandate before it sends value.",
  },
  {
    topic: "Mandate enforcement",
    demo: "A TypeScript function checks signatures, the spending ceiling and the counterparty score before the escrow step.",
    enterprise:
      "Cryptographic Know Your Agent checks and deterministic AP2 mandates are enforced in the TEE before any instruction reaches the ledger. A rogue or prompt-injected agent is contained by hardware, not by app code.",
  },
  {
    topic: "Attestation and key release",
    demo: "The platform seals each run with an ML-DSA-65 signature, but no hardware quote is checked and keys are never gated on one.",
    enterprise:
      "A PQC HSM / micro-KMS verifies the hardware PCR code-hash quote first, then provisions the ML-KEM wrapped master key. Ciphertext only opens inside the enclave after attestation passes, and the quote hash is bound to the execution output.",
  },
  {
    topic: "Webhooks",
    demo: "Webhooks from this app are signed with a shared-secret HMAC over TLS. Either side, or a leaked environment variable, can forge an event, and the payload is readable at proxies and in logs.",
    enterprise:
      "QUAS webhooks replace shared secrets with ML-DSA-65 signatures over a signed METHOD:URI:TIMESTAMP:BODY string, so the origin cannot be forged or denied. The payload travels as an ML-KEM and AES-256-GCM envelope that the gateway routes blind, inside a millisecond replay window, and only the attested enclave decrypts it.",
  },
  {
    topic: "Hardware and edge reach",
    demo: "A single Node.js runtime on a cloud host.",
    enterprise:
      "Intel TDX, AMD SEV-SNP and AWS Nitro in the cloud, ARM TrustZone and CCA at the edge, and RISC-V Keystone for custom silicon. Edge devices can sign mandates locally and settle later over an offline Bluetooth mesh.",
  },
]

const KVS: Difference[] = [
  {
    topic: "Memory",
    demo: "A small seeded settlement history, embedded for one request and then discarded.",
    enterprise:
      "Persistent semantic memory shared across every agent, model and ledger: counterparty reputation, trade decision context and risk models that improve with each settlement.",
  },
  {
    topic: "Where vectors are readable",
    demo: "Embeddings are plaintext in this server process, and the text is sent to an embedding model provider through the AI Gateway.",
    enterprise:
      "Vectors exist in plaintext only inside hardware-encrypted RAM. The store runs in process beside the TEE, so there is no external database call and no exfiltration surface.",
  },
  {
    topic: "Search",
    demo: "Cosine similarity in JavaScript over a handful of vectors.",
    enterprise:
      "A hardened Rust vector engine using quasicrystal geometric projections, built for sub-millisecond retrieval. Queries and results travel under ML-KEM and AES-256-GCM.",
  },
  {
    topic: "What it can hold",
    demo: "One buyer's past settlements.",
    enterprise:
      "Universal AI context and dynamic risk modelling, including large reference corpora such as vectorised regulatory manuals, kept inside the enclave.",
  },
]

const SETTLEMENT: Difference[] = [
  {
    topic: "Ledger",
    demo: "A modelled escrow and release. No ledger is involved, and the settlement ID is generated here.",
    enterprise:
      "Signed gRPC commands to Canton with sub-second T+0 atomic settlement. Sub-transaction privacy means only the parties to a trade can see it.",
  },
  {
    topic: "Escrow logic",
    demo: "Release is modelled on a signed sensor reading. The Intent, Cart and Payment mandate chain follows the AP2 shape.",
    enterprise:
      "AP2 conditional escrows as Daml contracts, with verifiable off-chain data delivery, automated refund routing and an on-ledger currency registry for stablecoins, SIT compute tokens and tokenised assets.",
  },
  {
    topic: "Legal standing",
    demo: "Illustrative. Nothing here creates an enforceable record.",
    enterprise:
      "Settled assets are designed to be Controllable Electronic Records under UCC Article 12, with an auditable chain from the first intent to the final settlement.",
  },
  {
    topic: "Scale",
    demo: "One run at a time, paced by live model calls, in a few seconds.",
    enterprise:
      "Institutional volumes, including trading desks, claims settlement and defence procurement. Kronova states under 5% post-quantum latency overhead compared with classical ECC.",
  },
]

function DifferenceList({ items, enterpriseLabel }: { items: Difference[]; enterpriseLabel: string }) {
  return (
    <ul className="space-y-3">
      {items.map((item) => (
        <li key={item.topic} className="rounded-lg border border-border">
          <h4 className="border-b border-border px-4 py-2 text-sm font-semibold text-foreground">{item.topic}</h4>
          <div className="grid divide-y divide-border md:grid-cols-2 md:divide-x md:divide-y-0">
            <div className="space-y-1 p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">This demo</p>
              <p className="text-sm leading-relaxed text-muted-foreground">{item.demo}</p>
            </div>
            <div className="space-y-1 bg-primary/5 p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-primary">{enterpriseLabel}</p>
              <p className="text-sm leading-relaxed text-foreground">{item.enterprise}</p>
            </div>
          </div>
        </li>
      ))}
    </ul>
  )
}

export function QuasKvsDifference() {
  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center gap-2">
          <CardTitle className="text-base">What this demo is, and what AetherNet QUAS and KVS add</CardTitle>
          <Badge variant="outline" className="font-normal">
            Not connected to this demo
          </Badge>
        </div>
        <CardDescription>
          The post-quantum signatures, sealed messages, live agents and mandate chain you just watched are real. What changes at
          enterprise scale is where the trust boundary sits: from this server to attested hardware.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Tabs defaultValue="quas">
          <TabsList className="grid h-auto w-full grid-cols-3">
            <TabsTrigger value="quas" className="gap-2 py-2">
              <Cpu className="h-4 w-4" aria-hidden="true" />
              <span>QUAS</span>
            </TabsTrigger>
            <TabsTrigger value="kvs" className="gap-2 py-2">
              <Database className="h-4 w-4" aria-hidden="true" />
              <span>KVS</span>
            </TabsTrigger>
            <TabsTrigger value="settlement" className="gap-2 py-2">
              <Landmark className="h-4 w-4" aria-hidden="true" />
              <span>Settlement</span>
            </TabsTrigger>
          </TabsList>
          <TabsContent value="quas" className="mt-4 space-y-3">
            <p className="text-sm text-muted-foreground">
              AetherNet QUAS is the cryptographic airgap: a Rust TEE that decapsulates, verifies and enforces before value moves.
            </p>
            <DifferenceList items={QUAS} enterpriseLabel="AetherNet QUAS" />
          </TabsContent>
          <TabsContent value="kvs" className="mt-4 space-y-3">
            <p className="text-sm text-muted-foreground">
              AetherNet KVS is the Kinetic Vector Store: post-quantum semantic memory that lives inside the same enclave boundary.
            </p>
            <DifferenceList items={KVS} enterpriseLabel="AetherNet KVS" />
          </TabsContent>
          <TabsContent value="settlement" className="mt-4 space-y-3">
            <p className="text-sm text-muted-foreground">
              Canton is the ledger layer that QUAS commands. The demo models it so you can see the full flow.
            </p>
            <DifferenceList items={SETTLEMENT} enterpriseLabel="AetherNet with Canton" />
          </TabsContent>
        </Tabs>

        <div className="rounded-lg border border-border bg-muted/30 p-4">
          <h3 className="text-sm font-semibold text-foreground">What carries over unchanged</h3>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
            The agents, the Intent, Cart and Payment mandate chain, the ML-DSA identities and the ML-KEM sealed message format are the
            same shapes the enterprise stack uses. Moving to QUAS and KVS changes where decryption, enforcement and memory happen, not how
            your agents are built.
          </p>
        </div>

        <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <h3 className="text-sm font-semibold text-foreground">See AetherNet QUAS and KVS in your environment</h3>
            <p className="text-sm leading-relaxed text-muted-foreground">
              The enterprise pilot covers attested enclave deployment, KVS onboarding of your counterparty and policy data, and Canton
              settlement. Review the program or contact Kronova to schedule a walkthrough.
            </p>
          </div>
          <Button asChild className="shrink-0">
            <a href="https://kronova.io/enterprise-pilot" target="_blank" rel="noopener noreferrer">
              Review the enterprise pilot
              <ArrowUpRight className="ml-2 h-4 w-4" aria-hidden="true" />
            </a>
          </Button>
        </div>

        <p className="text-xs text-muted-foreground">
          Descriptions of AetherNet QUAS, KVS and Canton settlement come from kronova.io. Performance figures are Kronova&apos;s own
          statements and are not measured by this demo.
        </p>
      </CardContent>
    </Card>
  )
}
