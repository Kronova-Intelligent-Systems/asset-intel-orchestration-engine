# Kronova Asset Intelligence Platform

Welcome to the official open-source frontend  and intelligent orchestration layer for the Kronova Intelligent Systems ecosystem. Most of the codebase is functional, production worthy, and scalable with relatively minor tweaks. 

This repository provides a production-ready Next.js application designed to orchestrate Real-World Asset (RWA) tokenization, run complex AI Agent workflows, and manage an OAuth 2.1 MCP server. It includes our comprehensive 44-field asset schema and a library of integrated AI tools out of the box.

---

## Architecture: Open Orchestration, Secure Execution

We believe that AI orchestration and UI layers should be open, flexible, and community-driven. However, we also know that executing legally binding financial state changes and managing post-quantum secure cryptographic settlement requires a zero-trust environment.

To give developers complete freedom over their UI without compromising enterprise security, we utilize a **Decoupled Settlement Architecture**:

### 1. The Orchestrator (This Repository)

Everything you see here is open-source under the **Apache 2.0 License**. You have complete freedom to run this locally, deploy it to your own infrastructure, add new AI models, or fork the UI. It handles the "thinking" — the AI routing, the data ingestion, and the payload construction.

### 2. The Engine: AetherNet QUAS (The Settlement Layer)

When your AI agents need to stop "thinking" and start "executing" (e.g., finalizing an RWA tokenization, moving funds, or interacting with secure hardware enclaves), this repository relies on the **AetherNet QUAS API**.

AetherNet acts as a black-box secure gateway, utilizing Canton smart contracts to ensure MEV resistance and post-quantum security.

---

## Getting Started

You can run the entire intelligence platform locally without an AetherNet subscription.

### 1. Clone and Install

```bash
git clone https://github.com/kronova/asset-intelligence-platform.git
cd asset-intelligence-platform
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

## Security and Maintenance Notice

​This repository is provided as a free, open-source orchestration sandbox. While I am obsessed with shipping perfectly secure, highly advanced code, my active development time is strictly focused on building the sovereign, post-quantum, architecture agnostic economic jurisdiction at Kronova/AetherNet. Because this specific frontend repository is neither paywalled nor commercially supported, it is not proactively audited for security regressions or edge cases.  

- ​Community Contributions: If you spot a vulnerability, responsible disclosures are highly appreciated (and will be patched). Community PRs to maintain and expand this codebase are always welcome.

- ​Enterprise Production: This repository provides the frontend orchestration and agent logic. However, if you require zero-trust, post-quantum secure transactions and true defense-in-depth, you must connect this platform to the proprietary AetherNet QUAS via an enterprise API key.  

---

## License

This project is licensed under the **Apache License 2.0**. See the [LICENSE](./LICENSE) file for the full text.

Apache 2.0 includes an explicit patent rights grant, meaning that contributors who submit code to this repository grant you a royalty-free license to any patents they hold that are necessarily infringed by their contribution.

## Trademark Notice

The Apache 2.0 license governs the source code in this repository. It does not grant permission to use the **Kronova** or **AetherNet** trade names, trademarks, or service marks in any way that implies endorsement or affiliation beyond describing the origin of the software. Forks and derivative works must remove all Kronova and AetherNet branding.
