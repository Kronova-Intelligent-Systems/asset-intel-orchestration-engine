# @kronova-intelligent-systems/sdk

Official TypeScript/JavaScript SDK for the [Kronova Intelligent Systems](https://kronova.io) Asset Intelligence Platform.

## Installation

```bash
npm install @kronova-intelligent-systems/sdk
# or
pnpm add @kronova-intelligent-systems/sdk
# or
yarn add @kronova-intelligent-systems/sdk
```

## Quick Start

```typescript
import { createKronovaClient } from "@kronova-intelligent-systems/sdk"

const kronova = createKronovaClient({
  apiKey: process.env.KRONOVA_API_KEY!,
})

// Assets
const assets = await kronova.assets.list()

// AI Agents
const result = await kronova.agents.execute("agent-id", {
  prompt: "Analyze asset performance for Q4",
})

// Kairo AI Support
const reply = await kronova.support.send([
  { role: "user", content: "What is the status of my fleet?" },
])
```

## API Reference

### `createKronovaClient(config)`

Creates a new Kronova SDK instance.

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `apiKey` | `string` | required | Your Kronova API key |
| `baseUrl` | `string` | `https://app.kronova.io/api/v1` | API base URL |
| `timeout` | `number` | `30000` | Request timeout in ms |
| `retries` | `number` | `3` | Number of retries on failure |
| `debug` | `boolean` | `false` | Enable debug logging |

### Clients

| Client | Description |
|--------|-------------|
| `kronova.assets` | Asset CRUD + AI insights |
| `kronova.agents` | AI agent execution + streaming |
| `kronova.workflows` | Workflow execution |
| `kronova.embeddings` | Vector embeddings + semantic search |
| `kronova.datasets` | Embedding dataset management |
| `kronova.tokenization` | Asset tokenization on-chain |
| `kronova.stablecoins` | Stablecoin mint/burn/transfer |
| `kronova.dataStreams` | Real-time SSE data streams |
| `kronova.oauth` | OAuth 2.1 with PKCE |
| `kronova.a2a` | Agent-to-Agent (A2A) protocol, served at `/api/a2a` on the same origin as `baseUrl`. Needs `read:agents` / `write:agents` scopes (`discover()` is public) |
| `kronova.support` | Kairo AI support chatbot |

## License

MIT — see [LICENSE](./LICENSE)
