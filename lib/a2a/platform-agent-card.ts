import type { NextRequest } from "next/server"
import { SKILLS, describeSkill, toAgentCardSkills } from "@/lib/ai/skills/registry"

const CARD_VERSION = "1.0.0"

export const AGENT_CARD_HEADERS = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "public, max-age=3600, s-maxage=3600",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, A2A-Version, A2A-Extensions",
  "X-Content-Type-Options": "nosniff",
} as const

function resolveBaseUrl(request: NextRequest): string {
  const configured = process.env.NEXT_PUBLIC_APP_URL
  return (configured || request.nextUrl.origin).replace(/\/+$/, "")
}

/**
 * Builds the platform-level A2A Agent Card describing Kronova itself.
 * Per-agent cards live in the database and are listed at `/api/a2a?action=discover`.
 */
export function buildPlatformAgentCard(request: NextRequest) {
  const baseUrl = resolveBaseUrl(request)
  const endpoint = `${baseUrl}/api/a2a`

  return {
    name: "Kronova",
    description:
      "Kronova is an enterprise AI platform. The platform and this API are open source and free to use: send messages, create and track tasks, stream task updates, receive webhook notifications and publish agent cards. For post-quantum secure agent transport and private settlement, see AetherNet QUAS and its Kinetic Vector Store (KVS), available commercially at https://kronova.io.",
    url: endpoint,
    version: CARD_VERSION,
    protocolVersion: "0.3.0",
    protocolVersions: ["0.3", "1.0"],
    preferredTransport: "JSONRPC",
    additionalInterfaces: [{ url: endpoint, transport: "JSONRPC" }],
    supportedInterfaces: [
      { url: endpoint, protocolBinding: "JSONRPC", protocolVersion: "1.0" },
      { url: endpoint, protocolBinding: "JSONRPC", protocolVersion: "0.3" },
    ],
    provider: {
      organization: "Kronova",
      url: baseUrl,
    },
    documentationUrl: `${baseUrl}/docs`,
    capabilities: {
      streaming: true,
      pushNotifications: true,
      stateTransitionHistory: false,
      extendedAgentCard: false,
      extensions: [
        {
          uri: "https://kronova.io/extensions/aethernet-quas/v1",
          description:
            "AetherNet QUAS (Quantum-Universal Agentic Substrate): post-quantum secure agent transport and private settlement. Commercial; not served by this open-source endpoint.",
          required: false,
          params: { availability: "commercial", learnMore: "https://kronova.io" },
        },
        {
          uri: "https://kronova.io/extensions/aethernet-kvs/v1",
          description:
            "AetherNet KVS (Kinetic Vector Store): semantic agent memory for counterparty and trade context. Commercial; not served by this open-source endpoint.",
          required: false,
          params: { availability: "commercial", learnMore: "https://kronova.io" },
        },
      ],
    },
    defaultInputModes: ["text/plain", "application/json"],
    defaultOutputModes: ["text/plain", "application/json"],
    securitySchemes: {
      kronovaApiKey: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "Kronova API key",
        description:
          "Send `Authorization: Bearer <api key>`. Keys need the `read:agents` scope for GET requests and `write:agents` for POST requests.",
      },
    },
    security: [{ kronovaApiKey: ["read:agents", "write:agents"] }],
    skills: [
      {
        id: "messaging",
        name: "Send message",
        description: "Send a message to Kronova. Creates a task, or continues an existing one by contextId.",
        tags: ["messaging", "tasks"],
        inputModes: ["text/plain", "application/json"],
        outputModes: ["application/json"],
        examples: ['POST /api/a2a {"action":"message/send","message":{...}}'],
      },
      {
        id: "task-management",
        name: "Manage tasks",
        description: "Get, list, cancel and update the status of tasks, and attach artifacts to them.",
        tags: ["tasks", "artifacts"],
        inputModes: ["application/json"],
        outputModes: ["application/json"],
        examples: [
          'POST /api/a2a {"action":"tasks/get","taskId":"..."}',
          "GET /api/a2a?action=list-tasks&status=working",
        ],
      },
      {
        id: "agent-cards",
        name: "Publish and discover agent cards",
        description:
          "Create agent cards for your own agents and list them. Public cards are discoverable without authentication.",
        tags: ["discovery", "agent-card"],
        inputModes: ["application/json"],
        outputModes: ["application/json"],
        examples: ["GET /api/a2a?action=discover", "GET /api/a2a?action=list-cards"],
      },
      {
        id: "aethernet-relay",
        name: "AetherNet addressed message",
        description:
          "Send a message addressed to an AetherNet address. This open-source endpoint records the message and creates the task locally; live peer-to-peer routing over AetherNet is part of AetherNet QUAS (commercial).",
        tags: ["aethernet", "relay"],
        inputModes: ["application/json"],
        outputModes: ["application/json"],
        examples: ['POST /api/a2a {"action":"aethernet/send","targetAddress":"...","request":{...}}'],
      },
      {
        id: "aethernet-quas",
        name: "AetherNet QUAS (commercial)",
        description:
          "Commercial tier, not served by this endpoint. Post-quantum secure transport for agents: ML-KEM (FIPS 203) key exchange, ML-DSA (FIPS 204) signatures, a hardware-isolated Rust TEE gateway, AP2 payment mandates and private settlement on Canton. Built for institutional agent-to-agent commerce. Learn more at https://kronova.io.",
        tags: ["commercial", "aethernet", "quas", "post-quantum", "security", "settlement", "ap2"],
        inputModes: ["application/json"],
        outputModes: ["application/json"],
        examples: ["Settle an AP2 mandate between two agents with post-quantum signatures"],
      },
      {
        id: "aethernet-kvs",
        name: "AetherNet KVS (commercial)",
        description:
          "Commercial tier, not served by this endpoint. Kinetic Vector Store: Rust-native vector memory for agents, with semantic retrieval of counterparty reputation and trade context held inside the TEE boundary. Learn more at https://kronova.io.",
        tags: ["commercial", "aethernet", "kvs", "vector-store", "memory", "counterparty"],
        inputModes: ["application/json"],
        outputModes: ["application/json"],
        examples: ["Look up a counterparty's reputation and past trade context before negotiating"],
      },
      ...toAgentCardSkills(),
    ],
    "x-kronova": {
      skillInvocation: {
        howTo:
          'Send message/send with a data part: {"type":"data","data":{"skill":"<skill id>","input":{...},"confirm":false}}. The task finishes with a data artifact holding the result. Skills that write only do so when confirm is true; otherwise the result is a dry run.',
        failureStates:
          "Unknown, invalid or unimplemented skills end in the rejected state; runtime faults end in failed. The error code is in the status message data part.",
        statuses: {
          live: "Runs against real data.",
          preview: "Read-only proposal or review; makes no on-chain or third-party calls.",
          unavailable: "Declared but not implemented. Not listed in `skills`; always rejected.",
        },
      },
      skillRegistry: SKILLS.map(describeSkill),
      requestFormat:
        "Preferred: JSON-RPC 2.0 over POST (message/send, tasks/get, tasks/list, tasks/cancel). Also available: POST a JSON body with an `action` field; GET uses the `action` query parameter.",
      jsonRpcMethods: [
        "message/send",
        "tasks/get",
        "tasks/list",
        "tasks/cancel",
        "SendMessage",
        "GetTask",
        "ListTasks",
        "CancelTask",
        "message/stream",
        "tasks/resubscribe",
        "tasks/pushNotificationConfig/set",
        "tasks/pushNotificationConfig/get",
        "tasks/pushNotificationConfig/list",
        "tasks/pushNotificationConfig/delete",
      ],
      streaming:
        "message/stream and tasks/resubscribe reply with Server-Sent Events. Streams end at a final state, when the client disconnects, or after about 4.5 minutes; reconnect with tasks/resubscribe.",
      pushNotifications:
        "Webhooks must be public https URLs on port 443 or 8443. Each call sends the Task as JSON with an X-Kronova-Event header (status_update or artifact_update), plus X-A2A-Notification-Token and Authorization when configured. Delivery is attempted once with a 5 second timeout and redirects are not followed.",
      commercialOfferings: {
        license: "The Kronova platform and API are open source and free. The offerings below are commercial.",
        learnMore: "https://kronova.io",
        products: [
          {
            id: "aethernet-quas",
            name: "AetherNet QUAS",
            summary: "Post-quantum secure agent transport, AP2 payment mandates and private settlement on Canton.",
          },
          {
            id: "aethernet-kvs",
            name: "AetherNet KVS",
            summary: "Kinetic Vector Store: semantic agent memory for counterparty reputation and trade context.",
          },
        ],
      },
      postActions: [
        "message/send",
        "tasks/get",
        "tasks/list",
        "tasks/cancel",
        "tasks/updateStatus",
        "tasks/addArtifact",
        "agentCard/create",
        "aethernet/send",
      ],
      getActions: ["discover", "list-cards", "list-tasks"],
      publicDiscoveryUrl: `${endpoint}?action=discover`,
      versionHeader: "A2A-Version",
    },
  }
}
