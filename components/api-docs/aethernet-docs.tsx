import Link from "next/link"
import { ArrowRight, Building2, CheckCircle2, EyeOff, Globe, Lock, Server, ShieldCheck } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { PILOT } from "@/lib/pilot/config"

const PLANES = [
  {
    id: "platform",
    icon: Globe,
    title: "Orchestration and intelligence platform API",
    badge: "Public API",
    badgeClass: "border-emerald-500/50 text-emerald-400 bg-emerald-500/10",
    rows: [
      ["What it is", "This platform: assets, agents, embeddings, data streams, tokenization and the A2A bridge."],
      ["Where it runs", "app.kronova.io/api/v1, with Edge Functions at api.kronova.io."],
      ["Authentication", "API key or OAuth 2.1 with PKCE. See the Auth tab."],
      ["Documentation", "This page, the API Reference tab and the TypeScript SDK."],
      ["Licensing", "Open source."],
    ],
  },
  {
    id: "aethernet",
    icon: Lock,
    title: "AetherNet QUAS and KVS",
    badge: "Enterprise pilot",
    badgeClass: "border-amber-500/50 text-amber-400 bg-amber-500/10",
    rows: [
      ["What it is", "QUAS is the Rust enclave that decapsulates and enforces. KVS is the Kinetic Vector Store it queries."],
      ["Where it runs", "Inside the AetherNet private infrastructure. QUAS runs in a hardware-isolated enclave and KVS is an airgapped pod that only QUAS queries."],
      ["Authentication", "ML-DSA-65 signed requests and ML-KEM-1024 sealed envelopes through the edge gateway. No API keys on QUAS or KVS."],
      ["Documentation", "Integration guides and your edge gateway URL are provided during pilot onboarding."],
      ["Licensing", "Commercial. Access is provisioned through the Enterprise Design Partner Pilot."],
    ],
  },
]

const LAYERS = [
  {
    icon: Globe,
    name: "Landing page",
    exposure: "Public",
    detail: "Protocol exploration and documentation. No agent traffic.",
  },
  {
    icon: ShieldCheck,
    name: "Edge gateway",
    exposure: "Public",
    detail:
      "The only public AetherNet surface. External agents submit AP2 mandates and ML-KEM sealed envelopes here. It verifies the signature and replay window and forwards ciphertext it cannot read. Partners receive its URL during onboarding.",
  },
  {
    icon: Server,
    name: "QUAS enclave",
    exposure: "Private network only",
    detail: "Runs in a hardware-isolated enclave. Only the gateway can reach it, and nothing else on the internet resolves it.",
  },
  {
    icon: EyeOff,
    name: "KVS",
    exposure: "Airgapped",
    detail:
      "Runs as an isolated pod. Only the QUAS enclave queries it, inside the private network. Keeping it off the internet is what keeps proprietary vectors and policy logic decrypted only inside the enclave.",
  },
]

const ALGORITHMS = [
  { use: "Signatures", name: "ML-DSA-65", standard: "FIPS 204", sizes: "1952-byte public key, 3309-byte signature" },
  { use: "Key encapsulation", name: "ML-KEM-1024 (Kyber-1024)", standard: "FIPS 203", sizes: "1568-byte public key, 1568-byte ciphertext, 32-byte shared secret" },
  { use: "Payload encryption", name: "AES-256-GCM", standard: "FIPS 197 and SP 800-38D", sizes: "Keyed from the ML-KEM shared secret" },
]

const PACKAGES = [
  {
    name: "@kronova-intelligent-systems/aethernet-pqc-sdk",
    version: "0.2.2",
    install: "pnpm add @kronova-intelligent-systems/aethernet-pqc-sdk",
    description: "Pure Rust compiled to WebAssembly. ML-DSA-65 key generation, signing and verification. Also on crates.io as aethernet-pqc-sdk.",
  },
  {
    name: "kronova-sdk",
    version: "0.4.1",
    install: "pnpm add kronova-sdk",
    description: "TypeScript wrapper that exposes the signature and key encapsulation primitives as one post-quantum API.",
  },
]

const VERIFY_CODE = `import init, {
  generate_pqc_keypair,
  sign_pqc_payload,
  verify_pqc_signature,
} from '@kronova-intelligent-systems/aethernet-pqc-sdk'

// Generate an ML-DSA-65 identity for an agent
const pair = generate_pqc_keypair()
const publicKey = Buffer.from(pair.public_key_b64, 'base64')
const privateKey = Buffer.from(pair.private_key_b64, 'base64')
pair.free()

// Sign a payload and verify it (3309-byte signature)
const message = new TextEncoder().encode('METHOD:URI:TIMESTAMP:BODY')
const signature = sign_pqc_payload(message, privateKey)
const valid = verify_pqc_signature(signature, message, publicKey)`

const PLATFORM_KEY_CODE = `// Fetch the platform's ML-DSA-65 public key and signing spec (unauthenticated)
const spec = await fetch('https://app.kronova.io/api/v1/pqc/platform-key')
  .then((res) => res.json())

console.log(spec.standard)       // "NIST FIPS 204 (ML-DSA-65)"
console.log(spec.signatureBytes) // 3309`

const DEMO_CODE = `// Run the live settlement demo and read the server-sent event stream
const res = await fetch('https://app.kronova.io/api/v1/aethernet-demo', {
  method: 'POST',
  headers: {
    Authorization: 'Bearer ' + process.env.KRONOVA_API_KEY, // needs write:agents
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ scenario: 'tamper' }), // clean | tamper | rogue
})

const reader = res.body.getReader()
const decoder = new TextDecoder()
let buffer = ''

while (true) {
  const { value, done } = await reader.read()
  if (done) break
  buffer += decoder.decode(value, { stream: true })
  const lines = buffer.split('\\n\\n')
  buffer = lines.pop()
  for (const line of lines) {
    const event = JSON.parse(line.replace('data: ', ''))
    if (event.type === 'step') console.log(event.step.title, event.step.status)
    if (event.type === 'done') console.log(event.result.outcome, event.result.auditRoot)
  }
}`

function CodeBlock({ filename, code }: { filename: string; code: string }) {
  return (
    <div className="enterprise-card overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2 border-b border-border/40 bg-muted/30">
        <span className="text-xs text-muted-foreground font-mono">{filename}</span>
      </div>
      <pre className="bg-card/80 text-foreground p-4 text-sm overflow-x-auto font-mono leading-relaxed">{code}</pre>
    </div>
  )
}

export function AetherNetDocs() {
  return (
    <div className="space-y-10">
      <div className="space-y-2">
        <h2 className="text-2xl font-bold">
          <span className="enterprise-text-gradient">AetherNet and the post-quantum SDKs</span>
        </h2>
        <p className="text-muted-foreground max-w-3xl">
          Kronova ships two distinct things. The orchestration and intelligence platform has a public REST API that you
          call with an API key or OAuth. AetherNet QUAS and KVS are a commercial, bare-metal stack that external agents
          reach through a signed, sealed handshake at the edge gateway.
        </p>
      </div>

      <section aria-labelledby="planes-heading" className="space-y-4">
        <h3 id="planes-heading" className="text-lg font-semibold text-foreground">
          Two separate planes
        </h3>
        <div className="grid lg:grid-cols-2 gap-5">
          {PLANES.map(({ id, icon: Icon, title, badge, badgeClass, rows }) => (
            <div key={id} className="enterprise-card p-5 space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-gradient-to-br from-primary/20 to-accent/10 rounded-lg border border-primary/20">
                    <Icon className="h-5 w-5 text-primary" aria-hidden="true" />
                  </div>
                  <h4 className="font-semibold text-foreground leading-tight">{title}</h4>
                </div>
                <Badge variant="outline" className={`shrink-0 text-xs ${badgeClass}`}>
                  {badge}
                </Badge>
              </div>
              <dl className="space-y-3 text-sm">
                {rows.map(([label, value]) => (
                  <div key={label} className="grid sm:grid-cols-[8rem_1fr] gap-1 sm:gap-3">
                    <dt className="text-muted-foreground">{label}</dt>
                    <dd className="text-foreground leading-relaxed">{value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          ))}
        </div>
      </section>

      <section aria-labelledby="layers-heading" className="space-y-4">
        <div className="space-y-1">
          <h3 id="layers-heading" className="text-lg font-semibold text-foreground">
            How AetherNet is exposed
          </h3>
          <p className="text-sm text-muted-foreground max-w-3xl">
            The zero-trust cryptographic airgap keeps the enclave and the vector store inside the private network, so
            agents connect through the edge gateway, which is the only public AetherNet surface.
          </p>
        </div>
        <ol className="grid md:grid-cols-2 gap-4">
          {LAYERS.map(({ icon: Icon, name, exposure, detail }, index) => (
            <li key={name} className="enterprise-card p-5 space-y-2">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono text-muted-foreground">{index + 1}</span>
                  <Icon className="h-4 w-4 text-primary" aria-hidden="true" />
                  <span className="font-semibold text-foreground text-sm">{name}</span>
                </div>
                <Badge variant="outline" className="text-xs border-border/50 text-muted-foreground">
                  {exposure}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">{detail}</p>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="crypto-heading" className="space-y-4">
        <h3 id="crypto-heading" className="text-lg font-semibold text-foreground">
          Post-quantum cryptography
        </h3>
        <div className="enterprise-card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/40 text-left text-muted-foreground">
                <th scope="col" className="px-4 py-3 font-medium">Use</th>
                <th scope="col" className="px-4 py-3 font-medium">Algorithm</th>
                <th scope="col" className="px-4 py-3 font-medium">Standard</th>
                <th scope="col" className="px-4 py-3 font-medium">Sizes</th>
              </tr>
            </thead>
            <tbody>
              {ALGORITHMS.map(({ use, name, standard, sizes }) => (
                <tr key={name} className="border-b border-border/20 last:border-0">
                  <td className="px-4 py-3 text-foreground">{use}</td>
                  <td className="px-4 py-3 font-mono text-foreground">{name}</td>
                  <td className="px-4 py-3 text-muted-foreground">{standard}</td>
                  <td className="px-4 py-3 text-muted-foreground">{sizes}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex items-start gap-3 rounded-lg border border-amber-500/40 bg-amber-500/5 p-4 text-sm">
          <ShieldCheck className="h-4 w-4 text-amber-400 mt-0.5 shrink-0" aria-hidden="true" />
          <p className="text-muted-foreground leading-relaxed">
            <span className="font-medium text-foreground">Upgrading from 0.2.1 or earlier.</span> Those releases used the
            CRYSTALS-Dilithium3 round 3 parameter set, which produces 3293-byte signatures. FIPS 204 ML-DSA-65 produces
            3309-byte signatures, so the two are not wire-compatible. Regenerate keys, and re-register any public key you
            stored, after moving to 0.2.2.
          </p>
        </div>
      </section>

      <section aria-labelledby="packages-heading" className="space-y-4">
        <h3 id="packages-heading" className="text-lg font-semibold text-foreground">
          Open-source SDKs
        </h3>
        <p className="text-sm text-muted-foreground max-w-3xl">
          The client-side SDKs are MIT licensed and public. They sign and seal on your side of the wire; they do not
          contain the QUAS or KVS services.
        </p>
        <div className="grid md:grid-cols-2 gap-5">
          {PACKAGES.map(({ name, version, install, description }) => (
            <div key={name} className="enterprise-card p-5 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <code className="text-sm font-mono text-foreground break-all">{name}</code>
                <Badge variant="outline" className="shrink-0 font-mono text-xs border-border/50">
                  {version}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
              <pre className="bg-muted/60 text-foreground px-3 py-2 rounded-md text-xs font-mono overflow-x-auto border border-border/30">
                {install}
              </pre>
            </div>
          ))}
        </div>
        <CodeBlock filename="sign-and-verify.ts" code={VERIFY_CODE} />
        <CodeBlock filename="platform-key.ts" code={PLATFORM_KEY_CODE} />
      </section>

      <section aria-labelledby="demo-heading" className="space-y-4">
        <div className="space-y-1">
          <h3 id="demo-heading" className="text-lg font-semibold text-foreground">
            Live settlement demo API
          </h3>
          <p className="text-sm text-muted-foreground max-w-3xl">
            <code className="font-mono text-foreground">POST /api/v1/aethernet-demo</code> runs the same demo as the
            dashboard and streams each step as a server-sent event. Choose a scenario: <code className="font-mono">clean</code>{" "}
            settles, <code className="font-mono">tamper</code> is rejected by the gateway, and{" "}
            <code className="font-mono">rogue</code> is blocked by mandate policy. Each step reports whether it ran live or
            on a stand-in. Runs are limited to one every six seconds per user.
          </p>
        </div>
        <CodeBlock filename="run-demo.ts" code={DEMO_CODE} />
      </section>

      <section
        aria-labelledby="access-heading"
        className="enterprise-card p-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4"
      >
        <div className="space-y-1 max-w-2xl">
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-primary" aria-hidden="true" />
            <h3 id="access-heading" className="font-semibold text-foreground">
              Access to AetherNet QUAS and KVS
            </h3>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Access is provisioned per partner through the Enterprise Design Partner Pilot, including the edge gateway URL
            and credentials for your agents.
          </p>
          <ul className="space-y-1 pt-1 text-sm text-muted-foreground">
            {["Gateway URL issued at onboarding", "Agent keys registered by public key", "Routing to QUAS and KVS handled by the gateway"].map(
              (item) => (
                <li key={item} className="flex items-center gap-2">
                  <CheckCircle2 className="h-3.5 w-3.5 text-primary shrink-0" aria-hidden="true" />
                  {item}
                </li>
              ),
            )}
          </ul>
        </div>
        <Button asChild className="enterprise-button shrink-0">
          <Link href={PILOT.url} target="_blank" rel="noopener noreferrer">
            Apply to the pilot
            <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
          </Link>
        </Button>
      </section>
    </div>
  )
}
