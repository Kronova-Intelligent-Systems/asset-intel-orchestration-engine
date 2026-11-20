/**
 * Kronova A2A Protocol API Endpoint
 * Implements the Agent2Agent (A2A) Protocol for agent interoperability
 *
 * Served at /api/a2a on the app origin (not on the Supabase custom domain).
 *
 * GET  ?action=discover | list-cards | list-tasks, ?agentId=..., ?taskId=...
 * POST { action: "message/send" | "tasks/get" | "tasks/list" | "tasks/cancel" |
 *        "tasks/updateStatus" | "tasks/addArtifact" | "agentCard/create" | "aethernet/send", ... }
 *
 * POST also accepts JSON-RPC 2.0 (single or batch) with A2A methods: message/send, tasks/get,
 * tasks/list, tasks/cancel and their v1.0 names (SendMessage, GetTask, ListTasks, CancelTask).
 * Streaming: message/stream and tasks/resubscribe reply with Server-Sent Events.
 * Push notifications: tasks/pushNotificationConfig/{set,get,list,delete}, or a
 * pushNotificationConfig in message/send configuration. Webhooks must be public https URLs.
 *
 * Authentication: Supabase session cookie or `Authorization: Bearer <api key>`.
 * API keys need `read:agents` for GET and `write:agents` for POST. Public Agent Card
 * discovery (`?action=discover`) requires no authentication.
 *
 * Reference: https://a2a-protocol.org/latest/specification/
 */

import { NextRequest, NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { createAdminSupabaseClient } from "@/lib/supabase/admin"
import { validateAPIAuth } from "@/lib/auth/api-auth"
import {
  createKronovaA2AClient,
  type SendMessageRequest,
  type GetTaskRequest,
  type ListTasksRequest,
  type CancelTaskRequest,
  A2AError,
  TaskNotFoundError,
} from "@/lib/a2a/kronova-a2a-client"
import {
  handleJsonRpcPayload,
  jsonRpcErrorResponse,
  unsupportedVersionResponse,
  JSON_RPC_ERROR,
} from "@/lib/a2a/jsonrpc"

// Event streams and push deliveries run inside this window; see STREAM_DEADLINE_MS
export const maxDuration = 300

const PROTOCOL_VERSION = "1.0"
const SUPPORTED_VERSIONS = ["0.3", "1.0"]

function versionError(request: NextRequest) {
  const requestedVersion = request.headers.get("A2A-Version")
  if (requestedVersion && !SUPPORTED_VERSIONS.includes(requestedVersion)) {
    return NextResponse.json(
      {
        error: "VersionNotSupportedError",
        message: `Version ${requestedVersion} not supported. Supported: ${SUPPORTED_VERSIONS.join(", ")}`,
      },
      { status: 400 },
    )
  }
  return null
}

/**
 * API-key callers have no session, so row-level security cannot identify them.
 * They use the service-role client; every query in the A2A client is scoped to
 * the key owner's user id.
 */
async function getDataClient(authMethod: "session" | "api_key") {
  return authMethod === "api_key" ? createAdminSupabaseClient() : await createServerSupabaseClient()
}

/**
 * Handle GET requests - Agent Card discovery, cards, and tasks
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const agentId = searchParams.get("agentId")
    const action = searchParams.get("action")

    const versionFailure = versionError(request)
    if (versionFailure) return versionFailure

    const auth = action === "discover" ? null : await validateAPIAuth(request, ["read:agents"])

    // A rejected credential is an error; having no credential falls through to public discovery
    if (auth && !auth.authenticated && request.headers.get("authorization")) {
      return NextResponse.json({ error: auth.error }, { status: auth.status || 401 })
    }

    // Agent Card discovery (public endpoint)
    if (!auth || !auth.authenticated || !auth.userId) {
      const publicSupabase = await createServerSupabaseClient()
      const { data: publicCards, error } = await publicSupabase
        .from("a2a_agent_cards")
        .select("*")
        .eq("is_public", true)
        .eq("is_active", true)

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
      }

      const cards = (publicCards || []).map((card) => ({
        agentId: card.agent_id,
        name: card.name,
        description: card.description,
        url: card.url,
        protocolVersions: card.protocol_versions,
        capabilities: card.capabilities,
        skills: card.skills,
        defaultInputModes: card.default_input_modes,
        defaultOutputModes: card.default_output_modes,
        provider: card.provider,
        documentationUrl: card.documentation_url,
      }))

      return NextResponse.json({
        agents: cards,
        protocolVersion: PROTOCOL_VERSION,
      })
    }

    const supabase = await getDataClient(auth.authMethod)
    const userId = auth.userId

    const client = createKronovaA2AClient({
      supabase,
      userId,
    })

    // Get specific agent card
    if (agentId) {
      const card = await client.getAgentCard(agentId)
      if (!card) {
        return NextResponse.json({ error: "Agent not found" }, { status: 404 })
      }
      return NextResponse.json(card)
    }

    // List user's agent cards
    if (action === "list-cards") {
      const { data: cards, error } = await supabase.from("a2a_agent_cards").select("*").eq("user_id", userId)

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
      }

      return NextResponse.json({ cards })
    }

    // Get task by ID
    const taskId = searchParams.get("taskId")
    if (taskId) {
      const historyLength = searchParams.get("historyLength")
      const task = await client.getTask({
        taskId,
        historyLength: historyLength ? parseInt(historyLength, 10) : undefined,
      })
      return NextResponse.json(task)
    }

    // List tasks
    if (action === "list-tasks") {
      const listRequest: ListTasksRequest = {
        contextId: searchParams.get("contextId") || undefined,
        status: (searchParams.get("status") as ListTasksRequest["status"]) || undefined,
        pageSize: searchParams.get("pageSize") ? parseInt(searchParams.get("pageSize")!, 10) : undefined,
        pageToken: searchParams.get("pageToken") || undefined,
        historyLength: searchParams.get("historyLength")
          ? parseInt(searchParams.get("historyLength")!, 10)
          : undefined,
        includeArtifacts: searchParams.get("includeArtifacts") === "true",
      }

      const response = await client.listTasks(listRequest)
      return NextResponse.json(response)
    }

    return NextResponse.json(
      {
        error:
          "Invalid request. Use ?action=discover, ?action=list-cards, ?action=list-tasks, ?agentId=..., or ?taskId=...",
      },
      { status: 400 },
    )
  } catch (error) {
    console.error("[A2A API] GET error:", error)
    if (error instanceof TaskNotFoundError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: 404 })
    }
    if (error instanceof A2AError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: 400 })
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

/**
 * Handle POST requests - Message sending and task management
 */
export async function POST(request: NextRequest) {
  try {
    let parsedBody: unknown
    let bodyParsed = true
    try {
      parsedBody = JSON.parse(await request.text())
    } catch {
      bodyParsed = false
    }

    // JSON-RPC 2.0 binding: a single request object or a batch array carrying `jsonrpc`
    const isJsonRpc =
      bodyParsed &&
      (Array.isArray(parsedBody) ||
        (typeof parsedBody === "object" && parsedBody !== null && "jsonrpc" in parsedBody))

    if (isJsonRpc) {
      const requestedVersion = request.headers.get("A2A-Version")
      if (requestedVersion && !SUPPORTED_VERSIONS.includes(requestedVersion)) {
        return unsupportedVersionResponse(requestedVersion, SUPPORTED_VERSIONS)
      }

      return await handleJsonRpcPayload(parsedBody, {
        signal: request.signal,
        authorize: (scope) => validateAPIAuth(request, [scope]),
        createClient: async (rpcAuth) =>
          createKronovaA2AClient({
            supabase: await getDataClient(rpcAuth.authMethod ?? "session"),
            userId: rpcAuth.userId!,
          }),
      })
    }

    const auth = await validateAPIAuth(request, ["write:agents"])

    if (!auth.authenticated || !auth.userId) {
      return NextResponse.json({ error: auth.error || "Unauthorized" }, { status: auth.status || 401 })
    }

    if (!bodyParsed) {
      return jsonRpcErrorResponse(JSON_RPC_ERROR.PARSE_ERROR, "Request body is not valid JSON", 400)
    }

    const versionFailure = versionError(request)
    if (versionFailure) return versionFailure

    const body = (parsedBody ?? {}) as Record<string, any>
    const { action, ...params } = body

    const client = createKronovaA2AClient({
      supabase: await getDataClient(auth.authMethod),
      userId: auth.userId,
    })

    switch (action) {
      case "message/send": {
        const sendRequest: SendMessageRequest = {
          message: params.message,
          configuration: params.configuration,
          metadata: params.metadata,
        }
        const result = await client.sendMessage(sendRequest)
        return NextResponse.json(result)
      }

      case "tasks/get": {
        const getRequest: GetTaskRequest = {
          taskId: params.taskId,
          historyLength: params.historyLength,
        }
        const task = await client.getTask(getRequest)
        return NextResponse.json(task)
      }

      case "tasks/list": {
        const listRequest: ListTasksRequest = params
        const response = await client.listTasks(listRequest)
        return NextResponse.json(response)
      }

      case "tasks/cancel": {
        const cancelRequest: CancelTaskRequest = {
          taskId: params.taskId,
        }
        const task = await client.cancelTask(cancelRequest)
        return NextResponse.json(task)
      }

      case "tasks/updateStatus": {
        const task = await client.updateTaskStatus(params.taskId, params.status)
        return NextResponse.json(task)
      }

      case "tasks/addArtifact": {
        const artifact = await client.addArtifact(params.taskId, params.artifact)
        return NextResponse.json(artifact)
      }

      case "agentCard/create": {
        const card = await client.createAgentCard(params.card)
        return NextResponse.json(card)
      }

      case "aethernet/send": {
        const result = await client.sendViaAetherNet(params.targetAddress, params.request)
        return NextResponse.json(result)
      }

      default:
        return NextResponse.json(
          {
            error: `Unknown action: ${action}. Valid actions: message/send, tasks/get, tasks/list, tasks/cancel, tasks/updateStatus, tasks/addArtifact, agentCard/create, aethernet/send`,
          },
          { status: 400 },
        )
    }
  } catch (error) {
    console.error("[A2A API] POST error:", error)
    if (error instanceof TaskNotFoundError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: 404 })
    }
    if (error instanceof A2AError) {
      return NextResponse.json({ error: error.message, code: error.code, details: error.details }, { status: 400 })
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

/**
 * Handle OPTIONS for CORS preflight
 */
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization, A2A-Version, A2A-Extensions",
    },
  })
}
