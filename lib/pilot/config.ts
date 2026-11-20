/**
 * Single source of truth for how this app talks about the AetherNet QUAS and KVS Enterprise Design Partner Pilot.
 * The full program (terms, modules, intake) lives at PILOT.url. Everything below is only the short summary the
 * demo needs inline, so changing the program means editing this file and the page at PILOT.url, nothing else.
 */

export const PILOT = {
  name: "AetherNet QUAS and KVS Enterprise Design Partner Pilot",
  shortName: "Enterprise Design Partner Pilot",
  url: "https://kronova.io/enterprise-pilot",
  contactEmail: process.env.NEXT_PUBLIC_PILOT_CONTACT_EMAIL ?? null,
  durationDays: 90,

  /** What a design partner receives. Mirrors section 2 of the LOI template. */
  terms: [
    { label: "Duration", value: "90 calendar days from provisioning of sandbox API credentials" },
    { label: "Pilot licensing fees", value: "Waived across the designated sandbox environments" },
    { label: "Access", value: "Self-serve sandbox API credentials, MIT-licensed post-quantum SDKs and developer documentation" },
    { label: "Cadence", value: "Bi-weekly 30-minute architectural syncs with the Kronova team" },
    { label: "Allocation", value: "One institutional slot per design partner, including a designated affiliate" },
  ],

  /** Capability modules a partner can evaluate. Mirrors section 3 of the LOI template. */
  modules: [
    "Omni-agnostic AI context substrate across foundation models and hardware enclaves",
    "End-to-end encrypted MCP and AP2 payloads over HTTPS, WSS and MQTTS",
    "Cryptographic Know Your Agent, rogue-agent containment and VoiceAgentAuth",
    "AetherNet KVS post-quantum secure vector store and perpetual memory",
    "Healthcare EDI 837 and SMART on FHIR adjudication sandbox, where applicable",
    "Canton settlement on Daml smart contracts",
  ],

  /** Who the program suits, shown in the qualification prompt. */
  fit: [
    "You run, or are building, autonomous agents that move money or regulated data",
    "You need decryption, policy enforcement and memory to sit inside an attested enclave",
    "You can dedicate an engineering contact for the 90-day evaluation",
  ],
} as const

export const PILOT_COPY = {
  toggleLabel: "AetherNet QUAS and KVS",
  toggleDescription: "Run this settlement through the attested enclave services instead of the open-source stand-ins.",
  dialogTitle: "AetherNet QUAS and KVS are available through the enterprise pilot",
  dialogDescription:
    "Access is provisioned per design partner so each organization gets isolated enclave capacity and its own sandbox credentials. A short sync tells us whether the 90-day pilot is a good fit.",
  primaryCta: "Request a pilot sync",
  secondaryCta: "Continue with the demo engine",
} as const
