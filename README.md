# Kronova Asset Intelligence and Orchestration Platform

Welcome to the official open-source frontend and orchestration layer for the Kronova Asset Intelligence ecosystem.

This repository provides a production-ready Next.js application designed to orchestrate Real-World Asset (RWA) tokenization, run complex AI Agent workflows, and manage an OAuth 2.1 MCP server. It includes our comprehensive 44-field asset schema and a library of integrated AI tools out of the box.

This project is free and open-source. It isn't backed by a paid support contract, so documentation and API references are kept as accurate as we can make them against the actual code — see [`PLATFORM_CAPABILITIES.md`](./PLATFORM_CAPABILITIES.md) for the full, up-to-date list of what's implemented today, cross-referenced with [`/docs`](./app/docs) and [`api-specifications.yaml`](./api-specifications.yaml).

> **API domains:** The Kronova REST API is served at `https://app.kronova.io/api/v1` (A2A at `https://app.kronova.io/api/a2a`). `https://api.kronova.io` is the custom domain of the Supabase backend and serves Supabase's own paths only — `/auth/v1` (including the OAuth 2.1 / MCP endpoints), `/rest/v1`, `/storage/v1` and `/functions/v1` (Edge Functions).

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

## Live Demo: Agent-to-Agent Settlement

The fastest way to see the architecture working is the **Live A2A Settlement Demo**. Sign up for a free account (email, GitHub or Google) and open it from the AI Suite at `/ai-suite/a2a-demo`. A public overview of everything the platform does is at `/platform`.

Two AI agents negotiate a $2M parts order (Meridian Aerospace buys 2,400 titanium actuator housings from Helix Precision) and settle it over post-quantum sealed messages. Three scenarios run end to end:

| Scenario | What happens |
| --- | --- |
| **Clean settlement** | The agents negotiate, a deterministic policy engine approves the mandate, and IoT delivery proof releases escrow. |
| **Man-in-the-middle** | An attacker alters the sealed mandate in transit. The gateway and the cipher both refuse it. |
| **Prompt-injected agent** | The buyer agent is tricked into over-paying. Deterministic mandate enforcement blocks the payment. |

Each step shows the payload, the signature checks and the architecture diagram lighting up as the request moves through the tiers (app, stateless gateway, QUAS and KVS, ledger).

### What is real and what is a stand-in

- **Real:** the agents' AI calls, ML-DSA signing and verification through [`aethernet-pqc-sdk`](#sdks-and-packages), ML-KEM-1024 (FIPS 203) key encapsulation with AES-256-GCM envelopes, and the policy checks.
- **Stand-in:** AetherNet QUAS and KVS themselves. By default the demo runs open-source stand-ins for both inside this server process (`lib/aethernet-demo/quas.ts` and `lib/aethernet-demo/kvs.ts`) so anyone can run it. The stand-ins show the behavior, not the hardware-isolated enclave, attestation or Canton settlement that the production services provide.
- **The engine switch:** the demo has an **AetherNet QUAS and KVS** toggle. For visitors who are not pilot partners it explains the Enterprise Design Partner Pilot and links to the application. For approved partners the same switch routes the run to the AetherNet services instead of the stand-ins.

### Switching the demo to AetherNet (operators)

The engine is chosen on the server in `lib/aethernet-demo/engine.ts`, and nothing routes to AetherNet until you opt in. Configuration lives in environment variables:

| Variable | Purpose |
| --- | --- |
| `AETHERNET_LIVE_ENABLED` | Set to `true` to allow routing to AetherNet. Off by default. |
| `AETHERNET_BASE_URL` | AetherNet edge gateway URL, provided during pilot onboarding. No default. This is always the edge gateway; agents never address QUAS or KVS directly. |
| `AETHER_API_KEY` | Bearer credential sent to the AetherNet services. |
| `AETHERNET_PILOT_ALLOWLIST` | Comma-separated user ids or emails of pilot partners. `*` opens it to every signed-in user, for internal demos. |
| `NEXT_PUBLIC_PILOT_CONTACT_EMAIL` | Optional contact email shown in the pilot dialog. |

The engine is used only when the switch is on, the services answer `GET /healthz`, and the signed-in user is on the allowlist. Otherwise the demo falls back to the stand-ins. Pilot terms are kept in one file, `lib/pilot/config.ts`, so the summary shown in the demo stays aligned with the program page at [kronova.io/enterprise-pilot](https://kronova.io/enterprise-pilot).

---

## SDKs and Packages

The demo and the platform use Kronova's public SDKs. They are MIT licensed and developed in [`kronova-public-sdks`](https://github.com/Kronova-Intelligent-Systems/kronova-public-sdks).

| Package | Registry | Install | Purpose |
| --- | --- | --- | --- |
| `@kronova-intelligent-systems/aethernet-pqc-sdk` | [npm](https://www.npmjs.com/package/@kronova-intelligent-systems/aethernet-pqc-sdk) | `pnpm add @kronova-intelligent-systems/aethernet-pqc-sdk` | Rust and WebAssembly execution edge for ML-DSA signatures. |
| `aethernet-pqc-sdk` | [crates.io](https://crates.io/crates/aethernet-pqc-sdk) | `cargo add aethernet-pqc-sdk` | The same engine for native Rust. |
| `kronova-sdk` | npm, source in [`kronova-public-sdks`](https://github.com/Kronova-Intelligent-Systems/kronova-public-sdks) | See the package README | TypeScript wrapper that exposes the cryptography as one post-quantum API. |
| `@kronova-intelligent-systems/sdk` | npm | `pnpm add @kronova-intelligent-systems/sdk` | Client SDK for this platform's REST API. See [`lib/sdk/README.md`](./lib/sdk/README.md). |

Where this repository uses them:

- `lib/pqc/crypto.ts` loads `aethernet-pqc-sdk` (WebAssembly) on the server to generate keypairs, sign and verify. `lib/aethernet-demo/crypto.ts` builds the demo's agent identities and sealed envelopes on top of it.
- `GET /api/v1/pqc/platform-key` publishes the platform's public key so anyone can verify its signatures with the same SDK.

`aethernet-pqc-sdk` 0.2.2 and `kronova-sdk` 0.4.1 implement NIST FIPS 204 ML-DSA-65 signatures (1952-byte public key, 3309-byte signature) and FIPS 203 ML-KEM-1024 key encapsulation. Earlier releases used the CRYSTALS-Dilithium3 round 3 parameter set, whose keys and signatures are not wire-compatible, so keys generated with 0.2.1 or earlier must be regenerated. Treat the demo as a reference implementation, not a certified module.

### Two separate planes

This repository is the open-source **orchestration and intelligence platform**. It exposes a public REST API at `https://app.kronova.io/api/v1`, authenticated with an API key or OAuth, and documented at `/docs`.

**AetherNet QUAS and KVS are a different, commercial plane.** QUAS (the Rust enclave) and KVS (the Kinetic Vector Store) run inside AetherNet's private infrastructure, with KVS airgapped behind QUAS. External agents reach AetherNet through its edge gateway, with ML-DSA-signed requests and ML-KEM sealed envelopes. Access is provisioned through the Enterprise Design Partner Pilot.

---

## Getting Started

You can run the entire intelligence platform locally without an AetherNet subscription, including the settlement demo, which falls back to the open-source stand-ins.

### 1. Clone and Install

```bash
git clone https://github.com/Kronova-Intelligent-Systems/asset-intel-orchestration-engine.git
cd asset-intel-orchestration-engine
pnpm install
```

### 2. Configure Environment Variables

Copy the `.env.example` file. For local development and testing, you can leave the AetherNet variables blank or use the provided sandbox endpoints.

```bash
cp .env.example .env.local
```

### 3. Run the Development Server

```bash
pnpm dev
```

---

## Going to Production: The AetherNet QUAS API

While the open-source sandbox is perfect for building UI and testing multi-agent workflows, public Web3 infrastructure cannot execute legally binding financial contracts or interact with Trusted Execution Environments (TEEs).

To move your workflows into production and unlock secure machine-to-machine settlement, this platform integrates seamlessly with the **AetherNet QUAS API**.

### Enterprise Pilot Program

We are currently onboarding a select group of institutional partners for the AetherNet QUAS and KVS Enterprise Design Partner Pilot, a 90-day evaluation. Pilot partners receive:

- Dedicated API keys for the AetherNet Canton settlement layer.
- Custom K8s/Docker deployment configurations.
- Direct engineering support for integrating our 44-field RWA schema with your existing compliance engines.
- The AetherNet KVS post-quantum vector store, so the settlement demo and your own agents can run against hardware-isolated memory instead of the open-source stand-in.

**[Apply for the Enterprise Pilot Program Here &rarr;](https://kronova.io/enterprise-pilot)**

---

## Contributing

This platform is actively evolving, and we welcome community contributions! We are currently looking for help with:

- Adding support for localized, open-weight LLMs.
- Expanding the 44-field RWA schema for new asset classes.
- Extending the OAuth 2.1 MCP server capabilities.

Please see our [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines on submitting Pull Requests.

---

## License

This project is licensed under the **Apache License 2.0**. See the [LICENSE](./LICENSE) file for the full text.

Apache 2.0 includes an explicit patent rights grant, meaning that contributors who submit code to this repository grant you a royalty-free license to any patents they hold that are necessarily infringed by their contribution.

## Trademark Notice

The Apache 2.0 license governs the source code in this repository. It does not grant permission to use the **Kronova** or **AetherNet** trade names, trademarks, or service marks in any way that implies endorsement or affiliation beyond describing the origin of the software. Forks and derivative works must remove all Kronova and AetherNet branding.
