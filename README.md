# Kronova Asset Intelligence and Orchestration Platform

Welcome to the official open-source frontend  and intelligent orchestration layer for the Kronova Intelligent Systems ecosystem. Most of the codebase is functional, production worthy, and scalable with relatively minor tweaks. 

Built with a NextJS 16 TypeScript Tailwind Shadcn-UI frontend, Supabase backend with Qdrant migration plan, Stripe ai_token metered subscriptions, any AI model with 30+ models pre-configured, embedding, RAG, and dataset management, Qdrant and Weaviate dataset imports, integrations including Salesforce, CrmOne, NetSuite, Shopify, Wix, Plaid, Resend, UPS, FedEx, Canton Network, Sui, and more. 

This SaaS platform and API is designed to enable individuals and companies to explore, augment, and or complete AI and Web 3 native digital transformations with a focus on Real World Asset (RWA) tokenization, real time agentic asset intelligence reporting, optimizations, and learning layers, voice NLP platform operations, OAuth 2.1 MCP server and client management, perpetual AI ROI analytics, and more. Users can deploy, run, orchestrate, and continously optimize AI agents and complex workflows using any AI model, an extensive library of pre-configured agents and flows and or build them from scratch. Direct agent output to learning layers, enhance agentic ops with 18 custom AI tools, import and or create assets using our comprehensive 44-field asset schema, and more out of the box. 

For developers looking for a different UI and a lighting fast Rust and rspc powered backend, check out [Kronova Rust NextJS Example](https://github.com/kronova-intelligent-systems/kronova-rust-nextjs-example).  

---

## Architecture: Open Orchestration, Secure Execution

We believe that AI orchestration and UI layers should be open, flexible, and community-driven. However, we also know that executing legally binding financial state changes and managing post-quantum secure cryptographic settlement requires a zero-trust environment.

To give developers complete freedom over their UI without compromising enterprise security, we utilize a **Decoupled Settlement Architecture**:

### 1. The Orchestrator (This Repository)

Everything you see here is open-source under the **Apache 2.0 License**. You have complete freedom to run this locally, deploy it to your own infrastructure, add new AI models, or fork the UI. It handles the "thinking" — the AI routing, the data ingestion, and the payload construction.

### 2. The Engine: AetherNet QUAS and KVS (High speed, horizontally scalable, post quantum secure execution, kinetic vector store, and instsnt settlement layer)

When your AI agents need to stop "thinking" and start "executing" (e.g., finalizing an RWA tokenization, institutional MCP order routing and trades, multi-party conditional escrows, off-chain data delivery, risk engine automated refund routing, MCPs as payload, interacting with secure hardware enclaves), this repository relies on the **AetherNet QUAS API**.

AetherNet QUAS (Quantum Universal Agentic Substrate) and KVS (Kinetic Vector Store) act as an institutional grade, sovereign, new-era mainframe capable of handling the entire agentic/M2M commerce life cycle. The Substrate leverages a proprietary, cloud agnostic, sovereign, Rust based trusted exeution environment (TEE) secured by proprietary post quantum FIPS 203 ML-DSA KMS and HSM along with optional post quantum FIPS 204 ML-KEM E2EE for mission critical cases. By shifting execution off chain and into our sovereign, Rust QTEE, AetherNet QUAS mathematically eliminates MEV, MIT, and HNDL attacks. The Rust QTEE then hands off the transaction to our custom enterprise grade Canton node and DAML smart contracts that assure deterministic, AP2 interoperable, instant, and private settlement on Canton Network. For use delivering a turnkey post-quantum agentic substrate, AetherNet enables institutional partners to immediately deploy autonomous AI agent workflows while completely mitigating quantum decryption risk, MEV exploitation, and deferred finality costs. require public settlement, delivering a turnkey post-quantum agentic substrate, AetherNet enables institutional partners to immediately deploy autonomous AI agent workflows while completely mitigating quantum decryption risk, MEV exploitation, and deferred finality costs. iemrkjj3 EVM chains, BitCoin, 

---

## Getting Started

You can run the entire intelligence platform locally without an AetherNet subscription.

### 1. Clone and Install

```bash
git clone https://github.com/kronova/asset-intel-orchestration-engine.git
cd asset-intel-orchestration-engine
npm install
```

### 2. Configure Environment Variables

Copy the `.env.example` file. For local development and testing, you can leave the AetherNet variables blank or use the provided sandbox endpoints.

```bash
cp .env.example .env.local
```

### 3. Run the Development Server

```bash
npm run dev
```

---

## Going to Production: The AetherNet QUAS API

While the open-source sandbox is perfect for building UI and testing multi-agent workflows, public Web3 infrastructure cannot execute legally binding financial contracts or interact with Trusted Execution Environments (TEEs).

To move your workflows into production and unlock secure machine-to-machine settlement, this platform integrates seamlessly with the **AetherNet QUAS API**.

### Enterprise Pilot Program

We are currently onboarding a select group of institutional partners for the AetherNet Enterprise Pilot. Pilot partners receive:

- Dedicated API keys for the AetherNet Canton settlement layer.
- Custom K8s/Docker deployment configurations.
- Direct engineering support for integrating our 44-field RWA schema with your existing compliance engines.

**[Apply for the Enterprise Pilot Program Here &rarr;](https://kronova.io/enterprise-pilot)**

---

​### Security & Maintenance Notice

​This repository is provided as a free, open-source orchestration sandbox. While I am obsessed with shipping perfectly secure, highly advanced code, my active development time is strictly focused on building the sovereign, post-quantum, architecture agnostic economic jurisdiction at Kronova/AetherNet. Because this specific frontend repository is neither paywalled nor commercially supported, it is not proactively audited for security regressions or edge cases.  

- ​Community Contributions: If you spot a vulnerability, responsible disclosures are highly appreciated (and will be patched). Community PRs to maintain and expand this codebase are always welcome.

- ​Enterprise Production: This repository provides the frontend orchestration and agent logic. However, if you require zero-trust, post-quantum secure transactions and true defense-in-depth, you must connect this platform to the proprietary AetherNet QUAS via an enterprise API key.  

---

## License

This project is licensed under the **Apache License 2.0**. See the [LICENSE](./LICENSE) file for the full text.

Apache 2.0 includes an explicit patent rights grant, meaning that contributors who submit code to this repository grant you a royalty-free license to any patents they hold that are necessarily infringed by their contribution.

## Trademark Notice

The Apache 2.0 license governs the source code in this repository. It does not grant permission to use the **Kronova** or **AetherNet** trade names, trademarks, or service marks in any way that implies endorsement or affiliation beyond describing the origin of the software. Forks and derivative works must remove all Kronova and AetherNet branding.
