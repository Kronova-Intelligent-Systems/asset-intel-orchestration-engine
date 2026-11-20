import {
  Bot,
  Building,
  Calculator,
  Coins,
  Database,
  Handshake,
  Layers,
  Mic,
  Radar,
  ShieldCheck,
  Users,
  Workflow,
  Zap,
  type LucideIcon,
} from "lucide-react"

export interface Capability {
  name: string
  href: string
  icon: LucideIcon
  summary: string
  forDevelopers: string
}

export const CAPABILITY_GROUPS: { title: string; blurb: string; items: Capability[] }[] = [
  {
    title: "Build and run AI",
    blurb: "The core loop: define an agent, give it knowledge, and automate what it does.",
    items: [
      {
        name: "AI Agents",
        href: "/ai-suite/agents",
        icon: Bot,
        summary: "Create, configure and run autonomous agents against the models you choose.",
        forDevelopers: "Agents are callable over an authenticated API, so you can drive them from your own code.",
      },
      {
        name: "Workflows",
        href: "/ai-suite/workflows",
        icon: Workflow,
        summary: "Chain agents and tools into automated processes that run without you in the loop.",
        forDevelopers: "A working pattern for orchestrating multi-step agent runs you can lift into your own stack.",
      },
      {
        name: "Embeddings and RAG",
        href: "/ai-suite/embeddings",
        icon: Layers,
        summary: "Turn your documents into searchable vectors so agents answer from your own data.",
        forDevelopers: "A reference vector search and retrieval flow, including where the data and keys sit.",
      },
      {
        name: "Voice Agent",
        href: "/ai-suite/voice-agent",
        icon: Mic,
        summary: "Drive the platform by speaking, with natural-language commands and voice responses.",
        forDevelopers: "Shows how speech-to-intent can sit in front of the same agent and tool layer.",
      },
    ],
  },
  {
    title: "Operate real-world assets",
    blurb: "Connect agents to physical equipment, devices and the records that describe them.",
    items: [
      {
        name: "Asset Intelligence",
        href: "/ai-suite/asset-intelligence",
        icon: Building,
        summary: "Track asset lifecycles with predictive analytics and AI-assisted analysis.",
        forDevelopers: "An example data model for assets that agents can read, reason about and update.",
      },
      {
        name: "IoT Command Center",
        href: "/ai-suite/iot",
        icon: Radar,
        summary: "Monitor devices and critical infrastructure and feed their signals to your agents.",
        forDevelopers: "A pattern for treating device data as verifiable proof an agent can act on.",
      },
      {
        name: "Tokenization",
        href: "/ai-suite/tokenization",
        icon: Coins,
        summary: "Represent assets as tokens with provenance you can verify.",
        forDevelopers: "A worked example of tying a real asset to an on-chain record.",
      },
    ],
  },
  {
    title: "Settle and see the value",
    blurb: "Watch agents transact, then measure whether any of it is worth doing.",
    items: [
      {
        name: "Live A2A Settlement Demo",
        href: "/ai-suite/a2a-demo",
        icon: Handshake,
        summary:
          "Two agents negotiate a purchase order and settle it over post-quantum sealed messages, including attack scenarios.",
        forDevelopers:
          "The clearest end-to-end walkthrough of agent-to-agent trust, with every step and payload on screen.",
      },
      {
        name: "ROI Analytics",
        href: "/ai-suite/roi-analytics",
        icon: Calculator,
        summary: "Estimate and track the return on your AI investments with a structured calculator.",
        forDevelopers: "Useful scaffolding if you need to justify an agent project internally.",
      },
    ],
  },
  {
    title: "Connect and govern",
    blurb: "Plug the suite into your stack and control who and what can call it.",
    items: [
      {
        name: "Integrations",
        href: "/ai-suite/integrations",
        icon: Zap,
        summary: "Connect storefronts and external platforms so agents can work with live business data.",
        forDevelopers: "Shows how third-party connectors can be authorised and kept separate per user.",
      },
      {
        name: "Databases",
        href: "/ai-suite/managed-databases",
        icon: Database,
        summary: "Create and manage dedicated databases for the data your agents depend on.",
        forDevelopers: "A reference for giving each project its own isolated data store.",
      },
      {
        name: "Teams",
        href: "/ai-suite/teams",
        icon: Users,
        summary: "Bring colleagues into a shared workspace with their own access.",
        forDevelopers: "A starting point for multi-user access around shared agents and data.",
      },
      {
        name: "Service accounts and OAuth",
        href: "/ai-suite/settings/service-accounts",
        icon: ShieldCheck,
        summary: "Issue machine identities, API keys and scoped OAuth access for programmatic use.",
        forDevelopers: "Scoped credentials for machines, so agents act with least privilege rather than a shared key.",
      },
    ],
  },
]

export const AUDIENCES = [
  {
    id: "developers",
    label: "Developers",
    headline: "A working system to read, not just documentation to skim",
    points: [
      "See how agents, retrieval, workflows and settlement fit together in one running application.",
      "Call the platform from your own code with scoped API keys, service accounts and OAuth.",
      "Reuse the patterns for agent identity, mandate enforcement and signed messages in your own product.",
      "Inspect every step of the A2A demo, including the sealed payloads and the policy decision.",
    ],
  },
  {
    id: "teams",
    label: "Teams and operators",
    headline: "Try agent automation on your own data before you commit to it",
    points: [
      "Stand up agents and workflows without writing code, and keep a record of what they did.",
      "Bring in assets, documents and connected stores so results reflect your business.",
      "Use ROI Analytics to put a number on whether an automation is worth running.",
      "Invite colleagues so a pilot is something the whole team can evaluate together.",
    ],
  },
  {
    id: "companies",
    label: "Companies building their own",
    headline: "Groundwork you can follow or build on",
    points: [
      "Treat the suite as a reference architecture for an agent platform in your own domain.",
      "Borrow the structure: identity, per-user data isolation, scoped access and auditable agent actions.",
      "Run the settlement scenarios to see where a trust layer is needed before you design yours.",
      "When open-source components stop being enough, you know exactly which layer to harden.",
    ],
  },
] as const

export const PATHWAY = [
  {
    step: "1",
    title: "Explore for free",
    body: "Create an account and use the suite: agents, workflows, retrieval, voice, assets and IoT. There is no charge to learn how it works.",
  },
  {
    step: "2",
    title: "Run the live settlement demo",
    body: "Watch two agents negotiate and settle a deal, then replay the man-in-the-middle and prompt-injection scenarios and see what stops them.",
  },
  {
    step: "3",
    title: "Find the limits of the open stack",
    body: "The demo uses open-source stand-ins, so keys, policy checks and memory live in an ordinary server process. That is the right place to start and the wrong place to hold regulated value.",
  },
  {
    step: "4",
    title: "Move the trust layer into hardware",
    body: "AetherNet QUAS and KVS run enforcement, decryption and memory inside attested enclaves. The enterprise pilot is how qualified teams evaluate that for 90 days.",
  },
] as const
