"use client"

import { ChevronDown, ChevronRight, Database, Lock } from "lucide-react"
import { cn } from "@/lib/utils"
import type { DemoStep, Provenance, Tier } from "@/lib/aethernet-demo/types"

interface NodeSpec {
  id: string
  title: string
  subtitle?: string
  bullets?: string[]
  provenance: Provenance
  database?: boolean
  note?: string
}

interface TierSpec {
  tier: Tier
  heading: string
  scope: string
  panel: string
  node: string
  badge?: string
  lead?: { node: NodeSpec; connectorLabel: string }
  nodes: NodeSpec[]
  inner?: { label: string; bidirectional?: boolean }
}

const TIERS: TierSpec[] = [
  {
    tier: 1,
    heading: "Tier 1: Omni-modal edge & webhook ingress",
    scope: "app.kronova.io + aethernet-pqc-sdk",
    panel: "border-2 border-cyan-500 bg-slate-900",
    node: "border-cyan-500/30 bg-slate-800/70",
    nodes: [
      {
        id: "agents",
        title: "Autonomous Agents, Enterprise Webhooks & IoT",
        subtitle: "AP2 intents, healthcare EDI 837, cold-chain & SCADA events",
        bullets: ["Multi-model agents, voice NLP, RWA & clinical workflows run live in this suite"],
        provenance: "live",
      },
      {
        id: "sdk",
        title: "aethernet-pqc-sdk (Pure Rust / WASM)",
        bullets: [
          "Asymmetric webhook & mandate signing: FIPS-204 (ML-DSA-65)",
          "Healthcare identity: SMART on FHIR PQ-JWT",
          "True E2EE envelope: FIPS-203 (ML-KEM) + AES-256-GCM",
        ],
        provenance: "live",
        note: "Mandate signing and sealed envelopes run live here. Webhooks in this app still use HMAC; ML-DSA webhook signing arrives with QUAS webhooks.",
      },
    ],
    inner: { label: "Signs METHOD:URI:TIMESTAMP:BODY" },
  },
  {
    tier: 2,
    heading: "Tier 2: Stateless DMZ routing",
    scope: "Blind edge proxy",
    panel: "border border-slate-500 bg-slate-900",
    node: "border-slate-500/40 bg-slate-800/70",
    nodes: [
      {
        id: "gateway",
        title: "AetherNet TypeScript Gateway",
        bullets: [
          "Verifies the ML-DSA signature and the x-aethernet-payload-b64 header",
          "Enforces a millisecond replay window (cryptographic KYA)",
          "Blindly routes unreadable ciphertext (HTTPS / WSS / MQTTS)",
        ],
        provenance: "standin",
      },
    ],
  },
  {
    tier: 3,
    heading: "Tier 3: The cryptographic airgap",
    scope: "AetherNet QUAS, PQC HSM & KVS",
    badge: "Enterprise pilot",
    panel: "border-2 border-violet-400 bg-indigo-950",
    node: "border-violet-400/30 bg-indigo-900/50",
    lead: {
      connectorLabel: "Verified PCR quote releases the wrapped master DEK to QUAS and KVS",
      node: {
        id: "hsm",
        title: "PQC HSM / Micro-KMS & Remote Attestation Engine",
        bullets: [
          "Extracts and verifies hardware PCR code-hash quotes",
          "Multi-arch EnclaveProvider: AWS Nitro, Intel TDX, AMD SEV, RISC-V Keystone",
          "Provisions the ML-KEM wrapped master DEK (/v1/pqc/qdrant/attest)",
          "Seals finalized state proofs with FIPS-204 ML-DSA",
        ],
        provenance: "aethernet",
        note: "This demo only models the last step: the platform seals each run with an ML-DSA attestation. No hardware quote is verified here.",
      },
    },
    nodes: [
      {
        id: "quas",
        title: "AetherNet QUAS Execution Core (Bare-Metal Rust TEE)",
        bullets: [
          "Decapsulates the ML-KEM webhook / MCP envelope in isolated RAM",
          "Enforces pre-execution compliance (HIPAA, KYC, spend mandates)",
          "Mathematically rejects non-compliant webhooks and hallucinations",
        ],
        provenance: "standin",
      },
      {
        id: "kvs",
        title: "AetherNet KVS (Kinetic Vector Store)",
        bullets: [
          "PQC-hardened Rust/Qdrant fork in enclave RAM",
          "Unwraps the master DEK into a OnceLock singleton",
          "Sub-ms AES-256-GCM stream decryption for risk & policy RAG",
        ],
        provenance: "standin",
        database: true,
      },
    ],
    inner: { label: "Encrypted policy & context lookup", bidirectional: true },
  },
  {
    tier: 4,
    heading: "Tier 4: Deterministic settlement & immutable audit ledger",
    scope: "Ledger layer",
    panel: "border-2 border-emerald-500 bg-slate-900",
    node: "border-emerald-500/30 bg-slate-800/70",
    nodes: [
      {
        id: "canton",
        title: "Canton Network (Daml 3.5.16 Smart Contracts)",
        bullets: [
          "Commits agent DID + intent ref + PCR attestation hash to the ledger",
          "Mints an immutable SettlementReceipt (zero raw PII/PHI on-chain)",
          "T+0 atomic finality, designed for UCC Article 12, EU SFD and HIPAA requirements",
        ],
        provenance: "simulated",
      },
    ],
  },
]

const BETWEEN_TIERS = [
  "ML-DSA-signed request + ML-KEM sealed envelope",
  "Verified ciphertext stream",
  "Signed gRPC ledger command with PCR attestation hash",
]

const PROVENANCE_CHIP: Record<Provenance, { label: string; className: string }> = {
  live: { label: "Live in this demo", className: "border-emerald-400/40 bg-emerald-400/10 text-emerald-300" },
  standin: { label: "Open-source stand-in here", className: "border-amber-400/40 bg-amber-400/10 text-amber-300" },
  simulated: { label: "Modelled here", className: "border-sky-400/40 bg-sky-400/10 text-sky-300" },
  aethernet: { label: "AetherNet enclave", className: "border-cyan-400/40 bg-cyan-400/10 text-cyan-300" },
}

function NodeCard({ node, className }: { node: NodeSpec; className: string }) {
  const chip = PROVENANCE_CHIP[node.provenance]
  return (
    <div className={cn("flex min-w-0 flex-1 flex-col gap-2 rounded-lg border p-3 text-slate-50", className)}>
      <div className="flex items-start gap-2">
        {node.database && <Database className="mt-0.5 h-4 w-4 shrink-0 text-violet-300" aria-hidden="true" />}
        <h4 className="min-w-0 text-balance text-sm font-semibold leading-snug">{node.title}</h4>
      </div>
      {node.subtitle && <p className="text-xs leading-relaxed text-slate-300">{node.subtitle}</p>}
      {node.bullets && (
        <ul className="space-y-1 text-xs leading-relaxed text-slate-300">
          {node.bullets.map((bullet) => (
            <li key={bullet} className="flex gap-2">
              <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-slate-400" aria-hidden="true" />
              <span className="min-w-0">{bullet}</span>
            </li>
          ))}
        </ul>
      )}
      {node.note && <p className="text-[11px] italic leading-relaxed text-slate-400">{node.note}</p>}
      <span className={cn("mt-auto w-fit rounded-full border px-2 py-0.5 text-[11px] font-medium", chip.className)}>
        {chip.label}
      </span>
    </div>
  )
}

function InnerConnector({ label, bidirectional, lit }: { label: string; bidirectional?: boolean; lit: boolean }) {
  return (
    <div className="flex shrink-0 flex-col items-center justify-center gap-1 px-1 py-1 text-center md:w-40 md:py-0">
      <ChevronDown
        className={cn("h-4 w-4 md:hidden", lit ? "text-white" : "text-slate-500")}
        aria-hidden="true"
      />
      <ChevronRight
        className={cn("hidden h-4 w-4 md:block", lit ? "text-white" : "text-slate-500")}
        aria-hidden="true"
      />
      <span className="text-[11px] leading-snug text-slate-300">{label}</span>
      {bidirectional && <span className="sr-only">Two-way connection</span>}
    </div>
  )
}

function LeadConnector({ label, lit }: { label: string; lit: boolean }) {
  return (
    <div className="flex flex-col items-center gap-1 py-2 text-center">
      <span className="text-[11px] leading-snug text-slate-300">{label}</span>
      <ChevronDown className={cn("h-4 w-4", lit ? "text-white" : "text-slate-500")} aria-hidden="true" />
    </div>
  )
}

function TierConnector({ label, lit }: { label: string; lit: boolean }) {
  return (
    <div className="flex flex-col items-center py-1" aria-hidden="true">
      <span className={cn("h-3 w-0.5 rounded-full transition-colors duration-300", lit ? "bg-white" : "bg-slate-500")} />
      <span
        className={cn(
          "max-w-full rounded-full border px-3 py-1 text-center text-[11px] font-medium leading-snug transition-colors duration-300",
          lit ? "border-white/60 bg-white/10 text-white" : "border-slate-600 bg-slate-900 text-slate-300",
        )}
      >
        {label}
      </span>
      <span className={cn("h-3 w-0.5 rounded-full transition-colors duration-300", lit ? "bg-white" : "bg-slate-500")} />
      <ChevronDown className={cn("-mt-1 h-4 w-4", lit ? "text-white" : "text-slate-500")} />
    </div>
  )
}

export function ArchitectureDiagram({ steps, running }: { steps: DemoStep[]; running: boolean }) {
  const reached = new Set(steps.map((step) => step.tier))
  const latestTier = steps.at(-1)?.tier
  const rejectedTier = steps.find((step) => step.status === "rejected")?.tier
  const hasRun = steps.length > 0

  return (
    <figure className="space-y-3">
      <figcaption className="space-y-1">
        <h2 className="text-base font-semibold text-foreground">What you are using, and where it goes next</h2>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Tiers 1 and 2 are the agent and routing edge you are using in this suite. Tier 3 is the institutional cryptographic
          airgap available through the enterprise pilot: a PQC HSM that verifies hardware attestation and releases keys, the
          AetherNet QUAS enclave that enforces mandates, and AetherNet KVS memory. This walkthrough models QUAS and KVS with
          open-source components. Tier 4 is the ledger where settlement finalizes. The diagram lights up as the agents run.
        </p>
      </figcaption>

      <div className="rounded-xl border border-slate-800 bg-slate-950 p-3 sm:p-5">
        <ol className="mx-auto max-w-4xl" aria-label="Architecture tiers, top to bottom">
          {TIERS.map((spec, index) => {
            const isReached = reached.has(spec.tier)
            const isActive = running && latestTier === spec.tier
            const isRejected = rejectedTier === spec.tier
            return (
              <li key={spec.tier}>
                <section
                  aria-label={spec.heading}
                  aria-current={isActive ? "step" : undefined}
                  className={cn(
                    "rounded-xl p-3 transition-all duration-300 sm:p-4",
                    spec.panel,
                    hasRun && !isReached && "opacity-50",
                    isActive && "shadow-[0_0_0_4px_rgba(255,255,255,0.18)]",
                    isRejected && "border-red-500 shadow-[0_0_0_4px_rgba(239,68,68,0.25)]",
                  )}
                >
                  <header className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1">
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-50">{spec.heading}</h3>
                    <span className="text-xs text-slate-400">{spec.scope}</span>
                    {spec.badge && (
                      <span className="inline-flex items-center gap-1 rounded-full border border-violet-400/50 bg-violet-400/10 px-2 py-0.5 text-[11px] font-medium text-violet-200">
                        <Lock className="h-3 w-3" aria-hidden="true" />
                        {spec.badge}
                      </span>
                    )}
                    {isActive && (
                      <span className="ml-auto inline-flex items-center gap-1.5 text-xs font-medium text-white">
                        <span className="h-2 w-2 animate-pulse rounded-full bg-white" aria-hidden="true" />
                        Active
                      </span>
                    )}
                    {isRejected && <span className="ml-auto text-xs font-semibold text-red-400">Stopped here</span>}
                  </header>

                  {spec.lead && (
                    <>
                      <div className="flex">
                        <NodeCard node={spec.lead.node} className={spec.node} />
                      </div>
                      <LeadConnector label={spec.lead.connectorLabel} lit={isReached} />
                    </>
                  )}

                  <div className="flex flex-col md:flex-row md:items-stretch">
                    {spec.nodes.map((node, nodeIndex) => (
                      <div key={node.id} className="flex min-w-0 flex-1 flex-col md:flex-row md:items-stretch">
                        {nodeIndex > 0 && spec.inner && (
                          <InnerConnector
                            label={spec.inner.label}
                            bidirectional={spec.inner.bidirectional}
                            lit={isReached}
                          />
                        )}
                        <NodeCard node={node} className={spec.node} />
                      </div>
                    ))}
                  </div>
                </section>
                {index < TIERS.length - 1 && (
                  <TierConnector label={BETWEEN_TIERS[index]} lit={reached.has(TIERS[index + 1].tier)} />
                )}
              </li>
            )
          })}
        </ol>
      </div>
    </figure>
  )
}
