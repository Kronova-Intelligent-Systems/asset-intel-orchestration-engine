/**
 * A2A JSON-RPC 2.0 binding.
 *
 * Accepts both the A2A v0.3 method names (`message/send`, `tasks/get`, ...) and the
 * v1.0 names (`SendMessage`, `GetTask`, ...). Single requests, notifications and
 * batches are supported. `message/stream` and `tasks/resubscribe` answer with a
 * Server-Sent Events stream (single requests only), and the push notification
 * config methods manage webhooks that are called when a task changes.
 *
 * Reference: https://a2a-protocol.org/latest/specification/
 */

import { NextResponse } from "next/server"
import {
  A2AError,
  ContentTypeNotSupportedError,
  InvalidPushConfigError,
  PushConfigNotFoundError,
  TaskNotCancelableError,
  TaskNotFoundError,
  UnsupportedOperationError,
  type KronovaA2AClient,
  type ListTasksRequest,
  type Message,
  type Part,
  type PushNotificationConfig,
  type SendMessageRequest,
  type Task,
} from "./kronova-a2a-client"
import { decorateMessage, decoratePart, decorateResult, decorateTask } from "./wire"
import { STREAM_DEADLINE_MS, isTerminalState, sseResponse, watchTask } from "./streaming"

export const JSON_RPC_ERROR = {
  PARSE_ERROR: -32700,
  INVALID_REQUEST: -32600,
  METHOD_NOT_FOUND: -32601,
  INVALID_PARAMS: -32602,
  INTERNAL_ERROR: -32603,
  AUTH_REQUIRED: -32000,
  TASK_NOT_FOUND: -32001,
  TASK_NOT_CANCELABLE: -32002,
  PUSH_NOTIFICATION_NOT_SUPPORTED: -32003,
  UNSUPPORTED_OPERATION: -32004,
  CONTENT_TYPE_NOT_SUPPORTED: -32005,
  AUTHENTICATED_EXTENDED_CARD_NOT_CONFIGURED: -32007,
  VERSION_NOT_SUPPORTED: -32009,
} as const

const MAX_BATCH_SIZE = 20
const MAX_PARTS_PER_MESSAGE = 100

type JsonRpcId = string | number | null

interface JsonRpcSuccess {
  jsonrpc: "2.0"
  id: JsonRpcId
  result: unknown
}

interface JsonRpcFailure {
  jsonrpc: "2.0"
  id: JsonRpcId
  error: { code: number; message: string; data?: unknown }
}

type JsonRpcResponse = JsonRpcSuccess | JsonRpcFailure

type Scope = "read:agents" | "write:agents"

export interface JsonRpcAuthResult {
  authenticated: boolean
  userId?: string
  authMethod?: "session" | "api_key"
  error?: string
  status?: number
}

export interface JsonRpcContext {
  authorize: (scope: Scope) => Promise<JsonRpcAuthResult>
  createClient: (auth: JsonRpcAuthResult) => Promise<KronovaA2AClient>
  /** Aborted when the HTTP client disconnects, which ends any open event stream */
  signal?: AbortSignal
}

class JsonRpcError extends Error {
  constructor(
    public code: number,
    message: string,
    public data?: unknown,
  ) {
    super(message)
  }
}

const RESPONSE_HEADERS = {
  "Content-Type": "application/json; charset=utf-8",
  "Access-Control-Allow-Origin": "*",
  "Cache-Control": "no-store",
}

function failure(id: JsonRpcId, code: number, message: string, data?: unknown): JsonRpcFailure {
  return { jsonrpc: "2.0", id, error: { code, message, ...(data !== undefined ? { data } : {}) } }
}

function respond(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: RESPONSE_HEADERS })
}

export function jsonRpcErrorResponse(code: number, message: string, status: number, data?: unknown) {
  return respond(failure(null, code, message, data), status)
}

// ---------------------------------------------------------------------------
// Method table
// ---------------------------------------------------------------------------

type MethodKind = "read" | "write" | "unsupported" | "stream-send" | "stream-subscribe"

interface MethodDefinition {
  kind: MethodKind
  run?: (client: KronovaA2AClient, params: Record<string, unknown>) => Promise<unknown>
  code?: number
  message?: string
}

function buildSendRequest(params: Record<string, unknown>): SendMessageRequest {
  return {
    message: normalizeMessage(params.message),
    configuration: asOptionalObject(params.configuration, "configuration"),
    metadata: asOptionalObject(params.metadata, "metadata"),
  }
}

const sendMessage: MethodDefinition = {
  kind: "write",
  run: async (client, params) => decorateResult(await client.sendMessage(buildSendRequest(params))),
}

const streamSend: MethodDefinition = { kind: "stream-send" }
const streamSubscribe: MethodDefinition = { kind: "stream-subscribe" }

const getTask: MethodDefinition = {
  kind: "read",
  run: async (client, params) => {
    const task = await client.getTask({
      taskId: requireString(params.id ?? params.taskId, "id"),
      historyLength: optionalNonNegativeInt(params.historyLength, "historyLength"),
    })
    return decorateResult(task)
  },
}

const listTasks: MethodDefinition = {
  kind: "read",
  run: async (client, params) => {
    const pageSize = optionalNonNegativeInt(params.pageSize, "pageSize")
    if (pageSize !== undefined && (pageSize < 1 || pageSize > 100)) {
      throw new JsonRpcError(JSON_RPC_ERROR.INVALID_PARAMS, "pageSize must be between 1 and 100")
    }
    const request: ListTasksRequest = {
      contextId: optionalString(params.contextId, "contextId"),
      status: optionalString(params.status, "status") as ListTasksRequest["status"],
      pageSize,
      pageToken: optionalString(params.pageToken, "pageToken"),
      historyLength: optionalNonNegativeInt(params.historyLength, "historyLength"),
      includeArtifacts: params.includeArtifacts === true,
    }
    return decorateResult(await client.listTasks(request))
  },
}

const cancelTask: MethodDefinition = {
  kind: "write",
  run: async (client, params) =>
    decorateResult(await client.cancelTask({ taskId: requireString(params.id ?? params.taskId, "id") })),
}

const pushTaskId = (params: Record<string, unknown>) => requireString(params.taskId ?? params.id, "taskId")

/** v0.3 sends `{ id: taskId, pushNotificationConfigId }`; v1.0 sends `{ taskId, id: configId }`. */
const pushConfigId = (params: Record<string, unknown>) =>
  optionalString(
    params.pushNotificationConfigId ?? params.configId ?? (params.taskId !== undefined ? params.id : undefined),
    "pushNotificationConfigId",
  )

const setPushConfig: MethodDefinition = {
  kind: "write",
  run: async (client, params) => {
    const raw = asOptionalObject(params.pushNotificationConfig ?? params.config, "pushNotificationConfig")
    if (!raw) invalidParams("pushNotificationConfig must be provided")

    let eventsToSend: string[] | undefined
    if (raw.eventsToSend !== undefined) {
      if (!Array.isArray(raw.eventsToSend)) invalidParams("pushNotificationConfig.eventsToSend must be an array")
      eventsToSend = raw.eventsToSend.map(String)
    }

    const config: PushNotificationConfig = {
      id: optionalString(raw.id ?? params.configId, "pushNotificationConfig.id"),
      url: requireString(raw.url, "pushNotificationConfig.url"),
      token: optionalString(raw.token, "pushNotificationConfig.token"),
      authentication: asOptionalObject(raw.authentication, "pushNotificationConfig.authentication"),
      eventsToSend,
    }
    return client.setPushConfig(pushTaskId(params), config)
  },
}

const getPushConfig: MethodDefinition = {
  kind: "read",
  run: (client, params) => client.getPushConfig(pushTaskId(params), pushConfigId(params)),
}

const listPushConfigsV03: MethodDefinition = {
  kind: "read",
  run: (client, params) => client.listPushConfigs(pushTaskId(params)),
}

const listPushConfigsV10: MethodDefinition = {
  kind: "read",
  run: async (client, params) => ({ configs: await client.listPushConfigs(pushTaskId(params)), nextPageToken: "" }),
}

const deletePushConfig: MethodDefinition = {
  kind: "write",
  run: async (client, params) => {
    await client.deletePushConfig(pushTaskId(params), requireString(pushConfigId(params), "pushNotificationConfigId"))
    return null
  },
}

const extendedCardUnsupported: MethodDefinition = {
  kind: "unsupported",
  code: JSON_RPC_ERROR.AUTHENTICATED_EXTENDED_CARD_NOT_CONFIGURED,
  message: "An authenticated extended agent card is not configured.",
}

const METHODS: Record<string, MethodDefinition> = {
  "message/send": sendMessage,
  SendMessage: sendMessage,
  "tasks/get": getTask,
  GetTask: getTask,
  "tasks/list": listTasks,
  ListTasks: listTasks,
  "tasks/cancel": cancelTask,
  CancelTask: cancelTask,
  "message/stream": streamSend,
  SendStreamingMessage: streamSend,
  "tasks/resubscribe": streamSubscribe,
  SubscribeToTask: streamSubscribe,
  "tasks/pushNotificationConfig/set": setPushConfig,
  "tasks/pushNotificationConfig/get": getPushConfig,
  "tasks/pushNotificationConfig/list": listPushConfigsV03,
  "tasks/pushNotificationConfig/delete": deletePushConfig,
  CreateTaskPushNotificationConfig: setPushConfig,
  GetTaskPushNotificationConfig: getPushConfig,
  ListTaskPushNotificationConfigs: listPushConfigsV10,
  DeleteTaskPushNotificationConfig: deletePushConfig,
  "agent/getAuthenticatedExtendedCard": extendedCardUnsupported,
  GetExtendedAgentCard: extendedCardUnsupported,
}

// ---------------------------------------------------------------------------
// Parameter validation and normalization
// ---------------------------------------------------------------------------

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function invalidParams(message: string): never {
  throw new JsonRpcError(JSON_RPC_ERROR.INVALID_PARAMS, message)
}

function requireString(value: unknown, name: string): string {
  if (typeof value !== "string" || value.length === 0) invalidParams(`${name} must be a non-empty string`)
  return value
}

function optionalString(value: unknown, name: string): string | undefined {
  if (value === undefined || value === null) return undefined
  if (typeof value !== "string") invalidParams(`${name} must be a string`)
  return value
}

function optionalNonNegativeInt(value: unknown, name: string): number | undefined {
  if (value === undefined || value === null) return undefined
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
    invalidParams(`${name} must be a non-negative integer`)
  }
  return value
}

function asOptionalObject(value: unknown, name: string): any {
  if (value === undefined || value === null) return undefined
  if (!isObject(value)) invalidParams(`${name} must be an object`)
  return value
}

function normalizeRole(role: unknown): Message["role"] {
  if (role === "user" || role === "ROLE_USER") return "user"
  if (role === "agent" || role === "ROLE_AGENT") return "agent"
  return invalidParams('message.role must be "user" or "agent"')
}

/** Accepts v0.3 parts (`kind`), Kronova parts (`type`) and v1.0 parts (member presence). */
function normalizePart(raw: unknown, index: number): Part {
  if (!isObject(raw)) invalidParams(`message.parts[${index}] must be an object`)
  const metadata = asOptionalObject(raw.metadata, `message.parts[${index}].metadata`)
  const type = raw.type ?? raw.kind ?? (typeof raw.text === "string" ? "text" : raw.file ? "file" : raw.data ? "data" : undefined)

  if (type === "text") {
    if (typeof raw.text !== "string") invalidParams(`message.parts[${index}].text must be a string`)
    return { type: "text", text: raw.text, metadata }
  }
  if (type === "file") {
    if (!isObject(raw.file)) invalidParams(`message.parts[${index}].file must be an object`)
    const file = raw.file
    if (typeof file.bytes !== "string" && typeof file.uri !== "string") {
      invalidParams(`message.parts[${index}].file needs bytes or uri`)
    }
    const mimeType = file.mimeType ?? file.mediaType
    if (typeof mimeType !== "string") invalidParams(`message.parts[${index}].file.mimeType must be a string`)
    return {
      type: "file",
      file: {
        name: typeof file.name === "string" ? file.name : undefined,
        mimeType,
        bytes: typeof file.bytes === "string" ? file.bytes : undefined,
        uri: typeof file.uri === "string" ? file.uri : undefined,
      },
      metadata,
    }
  }
  if (type === "data") {
    if (!isObject(raw.data)) invalidParams(`message.parts[${index}].data must be an object`)
    return { type: "data", data: raw.data, metadata }
  }
  throw new JsonRpcError(
    JSON_RPC_ERROR.CONTENT_TYPE_NOT_SUPPORTED,
    `Unsupported part type at message.parts[${index}]. Use text, file or data.`,
  )
}

function normalizeMessage(raw: unknown): Message {
  if (!isObject(raw)) invalidParams("message must be an object")
  if (!Array.isArray(raw.parts) || raw.parts.length === 0) invalidParams("message.parts must be a non-empty array")
  if (raw.parts.length > MAX_PARTS_PER_MESSAGE) {
    invalidParams(`message.parts is limited to ${MAX_PARTS_PER_MESSAGE} entries`)
  }
  return {
    messageId: typeof raw.messageId === "string" && raw.messageId ? raw.messageId : `msg-${crypto.randomUUID()}`,
    role: normalizeRole(raw.role),
    parts: raw.parts.map(normalizePart),
    contextId: optionalString(raw.contextId, "message.contextId"),
    referenceTaskIds: Array.isArray(raw.referenceTaskIds) ? raw.referenceTaskIds.map(String) : undefined,
    metadata: asOptionalObject(raw.metadata, "message.metadata"),
    extensions: Array.isArray(raw.extensions) ? (raw.extensions as Message["extensions"]) : undefined,
  }
}

// ---------------------------------------------------------------------------
// Dispatch
// ---------------------------------------------------------------------------

function mapError(id: JsonRpcId, error: unknown): JsonRpcFailure {
  if (error instanceof JsonRpcError) return failure(id, error.code, error.message, error.data)
  if (error instanceof TaskNotFoundError) return failure(id, JSON_RPC_ERROR.TASK_NOT_FOUND, error.message, error.details)
  if (error instanceof PushConfigNotFoundError) {
    return failure(id, JSON_RPC_ERROR.TASK_NOT_FOUND, error.message, error.details)
  }
  if (error instanceof InvalidPushConfigError) return failure(id, JSON_RPC_ERROR.INVALID_PARAMS, error.message)
  if (error instanceof TaskNotCancelableError) {
    return failure(id, JSON_RPC_ERROR.TASK_NOT_CANCELABLE, error.message, error.details)
  }
  if (error instanceof UnsupportedOperationError) {
    return failure(id, JSON_RPC_ERROR.UNSUPPORTED_OPERATION, error.message, error.details)
  }
  if (error instanceof ContentTypeNotSupportedError) {
    return failure(id, JSON_RPC_ERROR.CONTENT_TYPE_NOT_SUPPORTED, error.message, error.details)
  }
  if (error instanceof A2AError && error.code.startsWith("PQC_")) {
    return failure(id, JSON_RPC_ERROR.INVALID_PARAMS, error.message, { code: error.code })
  }
  console.error("[A2A JSON-RPC] Internal error:", error)
  const code = error instanceof A2AError ? error.code : undefined
  return failure(id, JSON_RPC_ERROR.INTERNAL_ERROR, "Internal error", code ? { code } : undefined)
}

interface ParsedCall {
  id: JsonRpcId | undefined
  method: string
  params: Record<string, unknown>
}

function parseCall(raw: unknown): ParsedCall | JsonRpcFailure {
  if (!isObject(raw)) return failure(null, JSON_RPC_ERROR.INVALID_REQUEST, "Request must be a JSON object")
  const id = raw.id
  const validId = id === undefined || id === null || typeof id === "string" || typeof id === "number"
  const responseId: JsonRpcId = validId && id !== undefined ? (id as JsonRpcId) : null
  if (raw.jsonrpc !== "2.0") return failure(responseId, JSON_RPC_ERROR.INVALID_REQUEST, 'jsonrpc must be "2.0"')
  if (typeof raw.method !== "string" || raw.method.length === 0) {
    return failure(responseId, JSON_RPC_ERROR.INVALID_REQUEST, "method must be a non-empty string")
  }
  if (!validId) return failure(null, JSON_RPC_ERROR.INVALID_REQUEST, "id must be a string, number or null")
  if (raw.params !== undefined && !isObject(raw.params)) {
    return failure(responseId, JSON_RPC_ERROR.INVALID_PARAMS, "params must be an object")
  }
  return { id: id as JsonRpcId | undefined, method: raw.method, params: (raw.params as Record<string, unknown>) ?? {} }
}

function requiredScopes(calls: Array<ParsedCall | JsonRpcFailure>): Scope[] {
  const scopes = new Set<Scope>()
  for (const call of calls) {
    if ("error" in call) continue
    const kind = METHODS[call.method]?.kind
    if (kind === "write" || kind === "stream-send") scopes.add("write:agents")
    else scopes.add("read:agents")
  }
  if (scopes.size === 0) scopes.add("read:agents")
  return [...scopes]
}

async function execute(call: ParsedCall, client: KronovaA2AClient): Promise<JsonRpcResponse | null> {
  const id = call.id === undefined ? null : call.id
  const definition = METHODS[call.method]

  let response: JsonRpcResponse
  if (!definition) {
    response = failure(id, JSON_RPC_ERROR.METHOD_NOT_FOUND, `Method not found: ${call.method}`)
  } else if (definition.kind === "unsupported") {
    response = failure(id, definition.code!, definition.message!)
  } else if (definition.kind === "stream-send" || definition.kind === "stream-subscribe") {
    response = failure(id, JSON_RPC_ERROR.INVALID_REQUEST, "Streaming methods cannot be used in a batch")
  } else {
    try {
      response = { jsonrpc: "2.0", id, result: await definition.run!(client, call.params) }
    } catch (error) {
      response = mapError(id, error)
    }
  }

  // Notifications (no id) get no response
  return call.id === undefined ? null : response
}

/**
 * Opens an SSE stream. Failures before the stream starts (bad params, unknown task) come back
 * as an ordinary JSON-RPC error; the first event of a started stream is always the Task.
 */
async function handleStream(
  call: ParsedCall,
  kind: "stream-send" | "stream-subscribe",
  client: KronovaA2AClient,
  signal: AbortSignal,
) {
  const id = call.id === undefined ? null : call.id

  let initial: Task
  try {
    if (kind === "stream-send") {
      initial = (await client.sendMessage(buildSendRequest(call.params))) as Task
    } else {
      initial = await client.getTask({ taskId: requireString(call.params.id ?? call.params.taskId, "id") })
      if (isTerminalState(initial.status.state)) {
        throw new UnsupportedOperationError("tasks/resubscribe on a task in a terminal state")
      }
    }
  } catch (error) {
    return respond(mapError(id, error))
  }

  const frame = (result: unknown) => `data: ${JSON.stringify({ jsonrpc: "2.0", id, result })}\n\n`

  async function* frames() {
    yield frame(decorateTask(initial))
    for await (const event of watchTask(client, initial, { signal, deadlineMs: STREAM_DEADLINE_MS })) {
      if (event.type === "keepalive") {
        yield ": keepalive\n\n"
      } else if (event.type === "status") {
        yield frame({
          kind: "status-update",
          taskId: initial.id,
          contextId: initial.contextId,
          status: { ...event.status, message: decorateMessage(event.status.message) },
          final: event.final,
        })
      } else {
        yield frame({
          kind: "artifact-update",
          taskId: initial.id,
          contextId: initial.contextId,
          artifact: { ...event.artifact, parts: event.artifact.parts.map(decoratePart) },
          append: event.artifact.append ?? false,
          lastChunk: event.artifact.lastChunk ?? false,
        })
      }
    }
  }

  return sseResponse(frames(), (error) => {
    console.error("[A2A JSON-RPC] Stream error:", error)
    return `data: ${JSON.stringify(failure(id, JSON_RPC_ERROR.INTERNAL_ERROR, "Internal error"))}\n\n`
  })
}

export function unsupportedVersionResponse(requested: string, supported: string[]) {
  return jsonRpcErrorResponse(
    JSON_RPC_ERROR.VERSION_NOT_SUPPORTED,
    `Version ${requested} not supported. Supported: ${supported.join(", ")}`,
    400,
    { supported },
  )
}

/**
 * Handles an already-parsed JSON-RPC payload (single request or batch).
 * Authentication is resolved here so each method is checked against the scope it needs.
 */
export async function handleJsonRpcPayload(payload: unknown, context: JsonRpcContext) {
  const isBatch = Array.isArray(payload)
  if (isBatch && (payload.length === 0 || payload.length > MAX_BATCH_SIZE)) {
    return jsonRpcErrorResponse(
      JSON_RPC_ERROR.INVALID_REQUEST,
      `Batch must contain between 1 and ${MAX_BATCH_SIZE} requests`,
      400,
    )
  }

  const calls = (isBatch ? payload : [payload]).map(parseCall)

  let auth: JsonRpcAuthResult | null = null
  for (const scope of requiredScopes(calls)) {
    const result = await context.authorize(scope)
    if (!result.authenticated || !result.userId) {
      return jsonRpcErrorResponse(
        JSON_RPC_ERROR.AUTH_REQUIRED,
        result.error || "Authentication required. Provide a valid session or API key.",
        result.status || 401,
      )
    }
    auth = result
  }

  const client = await context.createClient(auth!)

  if (!isBatch) {
    const [call] = calls
    if (!("error" in call)) {
      const kind = METHODS[call.method]?.kind
      if (kind === "stream-send" || kind === "stream-subscribe") {
        return handleStream(call, kind, client, context.signal ?? new AbortController().signal)
      }
    }
  }

  const responses = (
    await Promise.all(calls.map((call) => ("error" in call ? Promise.resolve(call) : execute(call, client))))
  ).filter((response): response is JsonRpcResponse => response !== null)

  if (responses.length === 0) return new NextResponse(null, { status: 204, headers: RESPONSE_HEADERS })

  if (!isBatch) {
    const [only] = responses
    return respond(only, "error" in only && only.error.code === JSON_RPC_ERROR.INVALID_REQUEST ? 400 : 200)
  }
  return respond(responses)
}
