# Kronova Platform Capabilities

This document is the canonical index of what the Kronova Asset Intelligence Platform can do today, mapped directly to the product surfaces (`/ai-suite/*`), the documentation and API reference (`/docs`, [`api-specifications.yaml`](./api-specifications.yaml)). It exists so that capabilities described in one place are never out of sync with the others — if you add or change a feature, update it here too.

> **A note on scope:** This repository is a free, open-source project. It is maintained on a best-effort basis, not backed by a commercial support team. The list below reflects what is actually implemented in the codebase — not a roadmap or a sales pitch. Where something is a placeholder, sandboxed, or pending (such as the production API domain below), it is called out explicitly rather than glossed over.

---

## API base URLs

| Surface | Base URL | Served by |
|---|---|---|
| Kronova REST API | `https://app.kronova.io/api/v1` | Next.js route handlers (`app/api/v1/*`) |
| Agent2Agent (A2A) | `https://app.kronova.io/api/a2a` | Next.js route handler (`app/api/a2a`) |
| Supabase Edge Functions | `https://api.kronova.io/functions/v1/<name>` | Supabase (custom domain) |
| Supabase Auth, incl. OAuth 2.1 / MCP | `https://api.kronova.io/auth/v1/...` | Supabase (custom domain) |

`api.kronova.io` is the custom domain of the Supabase project, so it only serves Supabase's own gateway paths (`/auth/v1`, `/rest/v1`, `/storage/v1`, `/functions/v1`). The Kronova REST API routes are not available on it. The SDK defaults to `https://app.kronova.io/api/v1`.

---

## Product surfaces (`/ai-suite`)

| Area | Route | What it does |
|---|---|---|
| Asset Intelligence | `/ai-suite/asset-intelligence` | Central registry for the 44-field RWA asset schema — create, browse, filter, and inspect assets, and trigger AI-generated insights per asset. |
| AI Agents | `/ai-suite/agents` | Build, configure, and execute autonomous AI agents against your asset data and tools. |
| Workflows | `/ai-suite/workflows` | Compose multi-step automated business processes that chain agents, data lookups, and tokenization/settlement actions. |
| Embeddings & Search | `/ai-suite/embeddings` | Generate and manage vector embeddings for semantic search and RAG over your own datasets. |
| Data Sources | `/ai-suite/data-sources` | Connect and manage external data inputs feeding the intelligence layer. |
| Managed Databases | `/ai-suite/managed-databases` | Provision and inspect managed data storage backing your workspace. |
| Tokenization | `/ai-suite/tokenization` | Tokenize and fractionalize real-world assets, with settlement handled through the decoupled AetherNet QUAS layer. |
| AetherNet | `/ai-suite/aethernet` | Enterprise settlement/execution gateway integration surface (Canton smart contracts, post-quantum secure settlement). |
| IoT Fleet | `/ai-suite/iot-fleet` | Monitor live IoT sensor readings streamed in via Server-Sent Events. |
| Voice Agent | `/ai-suite/voice-agent` | Voice-driven asset management: speech-to-text capture, command processing, and text-to-speech responses. |
| Integrations | `/ai-suite/integrations` | Manage third-party service connections available to your agents and workflows. |
| Tools | `/ai-suite/tools` | Library of AI tools agents can call during execution. |
| Teams | `/ai-suite/teams` | Multi-user workspace and team member management. |
| Billing & Subscriptions | `/ai-suite/billing`, `/ai-suite/subscriptions` | Manage plan tier and billing details. |
| ROI Analytics | `/ai-suite/roi-analytics` | Reporting on the measurable return of AI-driven asset operations. |
| Settings (incl. OAuth) | `/ai-suite/settings` | Account settings, API key management, and OAuth 2.1 client registration for third-party/MCP integrations. |

---

## API capabilities (`/docs`)

The REST API mirrors the product surfaces above. Current categories, matching `api-specifications.yaml`:

- **Asset Intelligence** — CRUD on assets, plus AI-generated per-asset insights.
- **Embeddings & Search** — create embeddings, run semantic search, manage datasets.
- **Asset Tokenization** — tokenize assets on Sui/Canton, fractionalize tokenized positions.
- **Private Stablecoins** — deploy, mint, burn, and transfer USDC-backed stablecoins on the Canton Network.
- **AI Agents** — list agents, inspect agent details, execute an agent run.
- **Workflows** — list workflows, inspect details, execute a workflow run.
- **Real-time Data Streams** — Server-Sent Event feeds for agent execution events, workflow events, and IoT sensor readings.
- **OAuth 2.1 / MCP** — full authorization-code + PKCE flow, OAuth client registration and listing, for secure third-party and MCP integrations.
- **Voice Interface** — create a voice session, upload audio, process a voice command, synthesize speech.
- **Agent-to-Agent (A2A)** — structured agent-to-agent task protocol endpoint.

All authenticated endpoints accept either a bearer API key or an OAuth 2.1 access token and return a consistent JSON response envelope. See `/docs` for live request/response examples and the interactive Playground, or `api-specifications.yaml` for the full OpenAPI 3.1 definition.

---

## Documentation surfaces

- **`/docs`** serves as the single documentation and API reference hub (getting started, authentication, SDK install, endpoint reference, and the live Playground).
- **`README.md`** — project overview, architecture, and setup instructions.
- **This file (`PLATFORM_CAPABILITIES.md`)** — the capability index tying the above together.

---

## Keeping this document accurate

When you add, remove, or change an API route, a product page under `app/ai-suite/`, or an entry in `api-specifications.yaml`, update the corresponding row/bullet here in the same change. This file should never describe a capability that isn't actually implemented in the codebase.
