/**
 * Kronova A2A Protocol Client
 * Implements the Agent2Agent (A2A) Protocol for agent interoperability
 * 
 * Reference: https://a2a-protocol.org/latest/specification/
 * Version: 1.0.0
 */

import type { SupabaseClient } from "@supabase/supabase-js"
import { after } from "next/server"
import { decorateTask } from "./wire"
import { extractSkillInvocation, runSkillForTask } from "./skill-executor"
import { PqcError, attest, verifySender } from "@/lib/pqc/service"
import { a2aMessageBody } from "@/lib/pqc/sign"
import {
  MAX_PUSH_CONFIGS_PER_TASK,
  PUSH_EVENTS,
  PushUrlError,
  deliverPush,
  validatePushUrl,
  type PushEvent,
} from "./push-notifications"

// ============================================================================
// A2A PROTOCOL TYPES (Section 4 - Protocol Data Model)
// ============================================================================

export type TaskState = 
  | "submitted" 
  | "working" 
  | "input-required" 
  | "completed" 
  | "failed" 
  | "canceled" 
  | "rejected"

export interface TaskStatus {
  state: TaskState
  timestamp?: string
  message?: Message
}

export interface Message {
  messageId: string
  role: "user" | "agent"
  parts: Part[]
  referenceTaskIds?: string[]
  contextId?: string
  metadata?: Record<string, any>
  extensions?: Extension[]
}

export type Part = TextPart | FilePart | DataPart

export interface TextPart {
  type: "text"
  text: string
  metadata?: Record<string, any>
}

export interface FilePart {
  type: "file"
  file: FileContent
  metadata?: Record<string, any>
}

export interface FileContent {
  name?: string
  mimeType: string
  bytes?: string // base64 encoded
  uri?: string
}

export interface DataPart {
  type: "data"
  data: Record<string, any>
  metadata?: Record<string, any>
}

export interface Artifact {
  artifactId: string
  name?: string
  description?: string
  parts: Part[]
  index?: number
  append?: boolean
  lastChunk?: boolean
  metadata?: Record<string, any>
  extensions?: Extension[]
}

export interface Task {
  id: string
  contextId: string
  status: TaskStatus
  history?: Message[]
  artifacts?: Artifact[]
  metadata?: Record<string, any>
}

export interface Extension {
  uri: string
  data: Record<string, any>
}

// ============================================================================
// AGENT CARD TYPES (Section 4.1.2)
// ============================================================================

export interface AgentCapabilities {
  streaming?: boolean
  pushNotifications?: boolean
  extendedAgentCard?: boolean
  stateTransitionHistory?: boolean
}

export interface AgentSkill {
  id: string
  name: string
  description?: string
  inputModes?: string[]
  outputModes?: string[]
  tags?: string[]
  examples?: string[]
}

export interface AgentProvider {
  organization?: string
  url?: string
}

export interface SecurityScheme {
  type: "http" | "apiKey" | "oauth2" | "openIdConnect"
  scheme?: string
  bearerFormat?: string
  name?: string
  in?: "query" | "header" | "cookie"
  flows?: Record<string, any>
  openIdConnectUrl?: string
}

export interface AgentCard {
  agentId: string
  name: string
  description?: string
  url: string
  protocolVersions: string[]
  capabilities: AgentCapabilities
  skills?: AgentSkill[]
  securitySchemes?: Record<string, SecurityScheme>
  security?: Record<string, string[]>[]
  defaultInputModes?: string[]
  defaultOutputModes?: string[]
  provider?: AgentProvider
  documentationUrl?: string
}

// ============================================================================
// REQUEST/RESPONSE TYPES (Section 3 - Operations)
// ============================================================================

export interface SendMessageRequest {
  message: Message
  configuration?: SendMessageConfiguration
  metadata?: Record<string, any>
}

export interface SendMessageConfiguration {
  acceptedOutputModes?: string[]
  pushNotificationConfig?: PushNotificationConfig
  historyLength?: number
  blocking?: boolean
}

export interface PushNotificationConfig {
  id?: string
  url: string
  token?: string
  authentication?: { schemes?: string[]; credentials?: string }
  eventsToSend?: string[]
}

/** What the server returns for a stored config. Credentials and tokens are never echoed back. */
export interface TaskPushNotificationConfig {
  taskId: string
  pushNotificationConfig: {
    id: string
    url: string
    authentication?: { schemes?: string[] }
    eventsToSend: string[]
    active: boolean
    lastDeliveryAt?: string | null
    lastDeliveryStatus?: string | null
  }
}

export interface GetTaskRequest {
  taskId: string
  historyLength?: number
}

export interface ListTasksRequest {
  contextId?: string
  status?: TaskState
  pageSize?: number
  pageToken?: string
  historyLength?: number
  includeArtifacts?: boolean
}

export interface ListTasksResponse {
  tasks: Task[]
  nextPageToken: string
  pageSize: number
  totalSize: number
}

export interface CancelTaskRequest {
  taskId: string
}

// ============================================================================
// STREAMING TYPES (Section 3.2.3)
// ============================================================================

export interface StreamResponse {
  task?: Task
  message?: Message
  statusUpdate?: TaskStatusUpdateEvent
  artifactUpdate?: TaskArtifactUpdateEvent
}

export interface TaskStatusUpdateEvent {
  taskId: string
  contextId: string
  status: TaskStatus
  final: boolean
}

export interface TaskArtifactUpdateEvent {
  taskId: string
  contextId: string
  artifact: Artifact
}

// ============================================================================
// ERROR TYPES (Section 3.3.2)
// ============================================================================

export class A2AError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: Record<string, any>
  ) {
    super(message)
    this.name = "A2AError"
  }
}

export class TaskNotFoundError extends A2AError {
  constructor(taskId: string) {
    super(`Task not found: ${taskId}`, "TASK_NOT_FOUND", { taskId })
    this.name = "TaskNotFoundError"
  }
}

export class TaskNotCancelableError extends A2AError {
  constructor(taskId: string, currentState: TaskState) {
    super(`Task cannot be canceled: ${taskId}`, "TASK_NOT_CANCELABLE", { taskId, currentState })
    this.name = "TaskNotCancelableError"
  }
}

export class UnsupportedOperationError extends A2AError {
  constructor(operation: string) {
    super(`Operation not supported: ${operation}`, "UNSUPPORTED_OPERATION", { operation })
    this.name = "UnsupportedOperationError"
  }
}

export class ContentTypeNotSupportedError extends A2AError {
  constructor(contentType: string) {
    super(`Content type not supported: ${contentType}`, "CONTENT_TYPE_NOT_SUPPORTED", { contentType })
    this.name = "ContentTypeNotSupportedError"
  }
}

export class InvalidPushConfigError extends A2AError {
  constructor(message: string) {
    super(message, "INVALID_PUSH_CONFIG")
    this.name = "InvalidPushConfigError"
  }
}

export class PushConfigNotFoundError extends A2AError {
  constructor(taskId: string, configId?: string) {
    super(`Push notification config not found for task ${taskId}`, "PUSH_CONFIG_NOT_FOUND", { taskId, configId })
    this.name = "PushConfigNotFoundError"
  }
}

// ============================================================================
// KRONOVA A2A CLIENT
// ============================================================================

export interface KronovaA2AClientConfig {
  supabase: SupabaseClient
  userId: string
  agentCardId?: string
  aethernetAddress?: string
  baseUrl?: string
}

export class KronovaA2AClient {
  private supabase: SupabaseClient
  private userId: string
  private agentCardId?: string
  private aethernetAddress?: string
  private baseUrl: string
  private protocolVersion = "1.0"

  constructor(config: KronovaA2AClientConfig) {
    this.supabase = config.supabase
    this.userId = config.userId
    this.agentCardId = config.agentCardId
    this.aethernetAddress = config.aethernetAddress
    this.baseUrl = config.baseUrl || "https://app.kronova.io/api/a2a"
  }

  // ==========================================================================
  // AGENT CARD OPERATIONS
  // ==========================================================================

  /**
   * Create or update an Agent Card for this Kronova agent
   */
  async createAgentCard(card: Omit<AgentCard, "agentId">): Promise<AgentCard> {
    const agentId = `kronova-${this.userId}-${Date.now()}`
    
    const { data, error } = await this.supabase
      .from("a2a_agent_cards")
      .insert({
        user_id: this.userId,
        agent_id: agentId,
        name: card.name,
        description: card.description,
        url: card.url,
        protocol_versions: card.protocolVersions,
        capabilities: card.capabilities,
        skills: card.skills,
        security_schemes: card.securitySchemes,
        security: card.security,
        default_input_modes: card.defaultInputModes,
        default_output_modes: card.defaultOutputModes,
        provider: card.provider,
        documentation_url: card.documentationUrl,
        aethernet_address: this.aethernetAddress,
      })
      .select()
      .single()

    if (error) throw new A2AError(error.message, "CREATE_AGENT_CARD_FAILED")

    return {
      ...card,
      agentId,
    }
  }

  /**
   * Get Agent Card by ID or discover remote agent
   */
  async getAgentCard(agentId: string): Promise<AgentCard | null> {
    // Only the owner's cards and public cards are visible, even when running with the service-role client
    const { data: localCard } = await this.supabase
      .from("a2a_agent_cards")
      .select("*")
      .eq("agent_id", agentId)
      .or(`user_id.eq.${this.userId},is_public.eq.true`)
      .maybeSingle()

    if (localCard) {
      return this.mapDbToAgentCard(localCard)
    }

    // If not found locally, try to discover via well-known endpoint
    // This would typically be an HTTP call to the remote agent's /.well-known/agent.json
    return null
  }

  /**
   * List all public Agent Cards for discovery
   */
  async listPublicAgentCards(): Promise<AgentCard[]> {
    const { data, error } = await this.supabase
      .from("a2a_agent_cards")
      .select("*")
      .eq("is_public", true)
      .eq("is_active", true)

    if (error) throw new A2AError(error.message, "LIST_AGENT_CARDS_FAILED")

    return (data || []).map(this.mapDbToAgentCard)
  }

  // ==========================================================================
  // TASK OPERATIONS (Section 3.1)
  // ==========================================================================

  /**
   * Send a message to initiate or continue a task (Section 3.1.1)
   */
  async sendMessage(request: SendMessageRequest): Promise<Task | Message> {
    const taskId = `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    const contextId = request.message.contextId || `ctx-${Date.now()}`
    const messageId = request.message.messageId || `msg-${Date.now()}`

    // Validate before creating anything, so a rejected webhook leaves no orphan task
    const pushConfig = request.configuration?.pushNotificationConfig
      ? await this.normalizePushConfig(request.configuration.pushNotificationConfig)
      : null

    // Verified before anything is written. The `pqc` key is always set here, so a caller cannot forge it.
    const pqc = await this.verifyMessageSignature(request.message)
    const storedMessage: Message = { ...request.message, metadata: { ...(request.message.metadata ?? {}), pqc } }

    // Create task in database
    const { data: taskData, error: taskError } = await this.supabase
      .from("a2a_tasks")
      .insert({
        user_id: this.userId,
        task_id: taskId,
        context_id: contextId,
        current_state: "submitted",
        status: {
          state: "submitted",
          timestamp: new Date().toISOString(),
        },
        history: [],
        artifacts: [],
        metadata: request.metadata,
        push_notification_config: pushConfig
          ? { id: pushConfig.id, url: pushConfig.url, eventsToSend: pushConfig.eventsToSend }
          : null,
      })
      .select()
      .single()

    if (taskError) throw new A2AError(taskError.message, "CREATE_TASK_FAILED")

    if (pushConfig) {
      const { error: pushError } = await this.supabase.from("a2a_push_notification_configs").insert({
        task_id: taskData.id,
        config_id: pushConfig.id,
        url: pushConfig.url,
        authentication: pushConfig.authentication,
        events_to_send: pushConfig.eventsToSend,
      })
      if (pushError) throw new A2AError(pushError.message, "SET_PUSH_CONFIG_FAILED")
    }

    // Create message in database
    const { error: msgError } = await this.supabase
      .from("a2a_messages")
      .insert({
        user_id: this.userId,
        task_id: taskData.id,
        message_id: messageId,
        role: request.message.role,
        parts: request.message.parts,
        reference_task_ids: request.message.referenceTaskIds,
        context_id: contextId,
        metadata: storedMessage.metadata,
        extensions: request.message.extensions,
      })

    if (msgError) throw new A2AError(msgError.message, "CREATE_MESSAGE_FAILED")

    // Log to AI request logs for Kronova analytics
    await this.logA2ARequest(taskId, contextId, request)

    const invocation = extractSkillInvocation(request)
    if (invocation) {
      await runSkillForTask(
        {
          supabase: this.supabase,
          userId: this.userId,
          updateTaskStatus: (id, status) => this.updateTaskStatus(id, status),
          addArtifact: (id, artifact) => this.addArtifact(id, artifact),
        },
        taskId,
        contextId,
        invocation,
      )
      return this.getTask({ taskId })
    }

    return {
      id: taskId,
      contextId,
      status: {
        state: "submitted",
        timestamp: new Date().toISOString(),
      },
      history: [storedMessage],
      artifacts: [],
      metadata: request.metadata,
    }
  }

  /**
   * Get task by ID (Section 3.1.3)
   */
  async getTask(request: GetTaskRequest): Promise<Task> {
    const { data, error } = await this.supabase
      .from("a2a_tasks")
      .select(`
        *,
        a2a_messages (*),
        a2a_artifacts (*)
      `)
      .eq("task_id", request.taskId)
      .eq("user_id", this.userId)
      .single()

    if (error || !data) throw new TaskNotFoundError(request.taskId)

    return this.mapDbToTask(data, request.historyLength)
  }

  /**
   * List tasks with optional filtering (Section 3.1.4)
   */
  async listTasks(request: ListTasksRequest): Promise<ListTasksResponse> {
    let query = this.supabase
      .from("a2a_tasks")
      .select("*", { count: "exact" })
      .eq("user_id", this.userId)
      .order("created_at", { ascending: false })

    if (request.contextId) {
      query = query.eq("context_id", request.contextId)
    }
    if (request.status) {
      query = query.eq("current_state", request.status)
    }

    const pageSize = request.pageSize || 50
    const offset = request.pageToken ? parseInt(request.pageToken, 10) : 0

    query = query.range(offset, offset + pageSize - 1)

    const { data, error, count } = await query

    if (error) throw new A2AError(error.message, "LIST_TASKS_FAILED")

    const tasks = await Promise.all(
      (data || []).map(async (t) => {
        if (request.includeArtifacts) {
          const { data: artifacts } = await this.supabase
            .from("a2a_artifacts")
            .select("*")
            .eq("task_id", t.id)
          return this.mapDbToTask({ ...t, a2a_artifacts: artifacts }, request.historyLength)
        }
        return this.mapDbToTask(t, request.historyLength)
      })
    )

    const hasMore = (offset + pageSize) < (count || 0)

    return {
      tasks,
      nextPageToken: hasMore ? String(offset + pageSize) : "",
      pageSize,
      totalSize: count || 0,
    }
  }

  /**
   * Cancel a task (Section 3.1.5)
   */
  async cancelTask(request: CancelTaskRequest): Promise<Task> {
    const { data: existing, error: fetchError } = await this.supabase
      .from("a2a_tasks")
      .select("*")
      .eq("task_id", request.taskId)
      .eq("user_id", this.userId)
      .single()

    if (fetchError || !existing) throw new TaskNotFoundError(request.taskId)

    const terminalStates: TaskState[] = ["completed", "failed", "canceled", "rejected"]
    if (terminalStates.includes(existing.current_state as TaskState)) {
      throw new TaskNotCancelableError(request.taskId, existing.current_state as TaskState)
    }

    const { data, error } = await this.supabase
      .from("a2a_tasks")
      .update({
        current_state: "canceled",
        status: {
          state: "canceled",
          timestamp: new Date().toISOString(),
        },
      })
      .eq("id", existing.id)
      .select()
      .single()

    if (error) throw new A2AError(error.message, "CANCEL_TASK_FAILED")

    this.queuePushNotification(existing.id, request.taskId, "status_update")
    return this.mapDbToTask(data)
  }

  /**
   * Update task status (internal use for agents)
   */
  async updateTaskStatus(taskId: string, status: TaskStatus): Promise<Task> {
    const { data, error } = await this.supabase
      .from("a2a_tasks")
      .update({
        current_state: status.state,
        status,
        updated_at: new Date().toISOString(),
      })
      .eq("task_id", taskId)
      .eq("user_id", this.userId)
      .select()
      .single()

    if (error) throw new A2AError(error.message, "UPDATE_TASK_STATUS_FAILED")

    this.queuePushNotification(data.id, taskId, "status_update")
    return this.mapDbToTask(data)
  }

  /**
   * Add artifact to task
   */
  async addArtifact(taskId: string, artifact: Artifact): Promise<Artifact> {
    const { data: task } = await this.supabase
      .from("a2a_tasks")
      .select("id")
      .eq("task_id", taskId)
      .eq("user_id", this.userId)
      .single()

    if (!task) throw new TaskNotFoundError(taskId)

    const { data, error } = await this.supabase
      .from("a2a_artifacts")
      .insert({
        task_id: task.id,
        artifact_id: artifact.artifactId,
        name: artifact.name,
        description: artifact.description,
        parts: artifact.parts,
        artifact_index: artifact.index,
        append: artifact.append,
        last_chunk: artifact.lastChunk,
        metadata: artifact.metadata,
        extensions: artifact.extensions,
      })
      .select()
      .single()

    if (error) throw new A2AError(error.message, "ADD_ARTIFACT_FAILED")

    this.queuePushNotification(task.id, taskId, "artifact_update")
    return artifact
  }

  // ==========================================================================
  // PUSH NOTIFICATION CONFIGS (Section 3.1.7)
  // ==========================================================================

  private async requireTaskRow(taskId: string): Promise<{ id: string }> {
    const { data, error } = await this.supabase
      .from("a2a_tasks")
      .select("id")
      .eq("task_id", taskId)
      .eq("user_id", this.userId)
      .single()
    if (error || !data) throw new TaskNotFoundError(taskId)
    return data
  }

  private async normalizePushConfig(config: PushNotificationConfig) {
    if (!config || typeof config !== "object") throw new InvalidPushConfigError("pushNotificationConfig must be an object")

    try {
      await validatePushUrl(config.url)
    } catch (error) {
      if (error instanceof PushUrlError) throw new InvalidPushConfigError(error.message)
      throw error
    }

    if (config.id !== undefined && (typeof config.id !== "string" || !/^[A-Za-z0-9._:-]{1,128}$/.test(config.id))) {
      throw new InvalidPushConfigError("pushNotificationConfig.id must be 1-128 characters of letters, digits, . _ : -")
    }
    if (config.token !== undefined && (typeof config.token !== "string" || config.token.length > 512)) {
      throw new InvalidPushConfigError("pushNotificationConfig.token must be a string of at most 512 characters")
    }

    const eventsToSend = config.eventsToSend ?? [...PUSH_EVENTS]
    if (
      !Array.isArray(eventsToSend) ||
      eventsToSend.length === 0 ||
      eventsToSend.some((event) => !PUSH_EVENTS.includes(event as PushEvent))
    ) {
      throw new InvalidPushConfigError(`eventsToSend must be a non-empty subset of: ${PUSH_EVENTS.join(", ")}`)
    }

    const auth = config.authentication
    if (auth !== undefined) {
      const validSchemes =
        auth.schemes === undefined ||
        (Array.isArray(auth.schemes) &&
          auth.schemes.length <= 5 &&
          auth.schemes.every((scheme) => typeof scheme === "string" && /^[A-Za-z][A-Za-z0-9-]{0,31}$/.test(scheme)))
      const validCredentials =
        auth.credentials === undefined || (typeof auth.credentials === "string" && auth.credentials.length <= 2048)
      if (!auth || typeof auth !== "object" || !validSchemes || !validCredentials) {
        throw new InvalidPushConfigError("pushNotificationConfig.authentication must have string schemes and credentials")
      }
    }

    return {
      id: config.id ?? `cfg-${crypto.randomUUID()}`,
      url: config.url,
      eventsToSend: eventsToSend as string[],
      authentication:
        auth || config.token ? { schemes: auth?.schemes, credentials: auth?.credentials, token: config.token } : null,
    }
  }

  private mapDbToPushConfig(taskId: string, row: any): TaskPushNotificationConfig {
    return {
      taskId,
      pushNotificationConfig: {
        id: row.config_id,
        url: row.url,
        authentication: row.authentication?.schemes ? { schemes: row.authentication.schemes } : undefined,
        eventsToSend: row.events_to_send ?? [...PUSH_EVENTS],
        active: row.is_active !== false,
        lastDeliveryAt: row.last_delivery_at,
        lastDeliveryStatus: row.last_delivery_status,
      },
    }
  }

  async setPushConfig(taskId: string, config: PushNotificationConfig): Promise<TaskPushNotificationConfig> {
    const task = await this.requireTaskRow(taskId)
    const normalized = await this.normalizePushConfig(config)

    const { data: existing } = await this.supabase
      .from("a2a_push_notification_configs")
      .select("config_id")
      .eq("task_id", task.id)
    const ids = (existing || []).map((row: any) => row.config_id)
    if (!ids.includes(normalized.id) && ids.length >= MAX_PUSH_CONFIGS_PER_TASK) {
      throw new InvalidPushConfigError(`A task supports at most ${MAX_PUSH_CONFIGS_PER_TASK} push notification configs`)
    }

    const { data, error } = await this.supabase
      .from("a2a_push_notification_configs")
      .upsert(
        {
          task_id: task.id,
          config_id: normalized.id,
          url: normalized.url,
          authentication: normalized.authentication,
          events_to_send: normalized.eventsToSend,
          is_active: true,
        },
        { onConflict: "task_id,config_id" },
      )
      .select()
      .single()
    if (error) throw new A2AError(error.message, "SET_PUSH_CONFIG_FAILED")

    return this.mapDbToPushConfig(taskId, data)
  }

  async listPushConfigs(taskId: string): Promise<TaskPushNotificationConfig[]> {
    const task = await this.requireTaskRow(taskId)
    const { data, error } = await this.supabase
      .from("a2a_push_notification_configs")
      .select("*")
      .eq("task_id", task.id)
      .order("created_at", { ascending: true })
    if (error) throw new A2AError(error.message, "LIST_PUSH_CONFIGS_FAILED")
    return (data || []).map((row: any) => this.mapDbToPushConfig(taskId, row))
  }

  async getPushConfig(taskId: string, configId?: string): Promise<TaskPushNotificationConfig> {
    const configs = await this.listPushConfigs(taskId)
    const match = configId ? configs.find((entry) => entry.pushNotificationConfig.id === configId) : configs[0]
    if (!match) throw new PushConfigNotFoundError(taskId, configId)
    return match
  }

  async deletePushConfig(taskId: string, configId: string): Promise<void> {
    const task = await this.requireTaskRow(taskId)
    const { data, error } = await this.supabase
      .from("a2a_push_notification_configs")
      .delete()
      .eq("task_id", task.id)
      .eq("config_id", configId)
      .select("id")
    if (error) throw new A2AError(error.message, "DELETE_PUSH_CONFIG_FAILED")
    if (!data || data.length === 0) throw new PushConfigNotFoundError(taskId, configId)
  }

  /** Delivers after the response is sent, so a slow webhook never delays the caller. */
  private queuePushNotification(taskRowId: string, taskId: string, event: PushEvent) {
    const work = async () => {
      try {
        const { data: configs } = await this.supabase
          .from("a2a_push_notification_configs")
          .select("*")
          .eq("task_id", taskRowId)
          .eq("is_active", true)
          .contains("events_to_send", [event])
        if (!configs || configs.length === 0) return

        const payload = decorateTask(await this.getTask({ taskId }))
        await Promise.all(
          configs.map(async (config: any) => {
            const result = await deliverPush(
              { url: config.url, authentication: config.authentication },
              event,
              payload,
            )
            await this.supabase
              .from("a2a_push_notification_configs")
              .update({ last_delivery_at: new Date().toISOString(), last_delivery_status: result.status })
              .eq("id", config.id)
          }),
        )
      } catch (error) {
        console.error("[Kronova A2A] Push notification dispatch failed:", error)
      }
    }

    try {
      after(work)
    } catch {
      // Outside a request scope (scripts, tests) there is no after(); run it detached
      void work()
    }
  }

  // ==========================================================================
  // AETHERNET BRIDGE
  // ==========================================================================

  /**
   * Bridge A2A messages over AetherNet P2P network
   */
  async sendViaAetherNet(
    targetAddress: string,
    request: SendMessageRequest
  ): Promise<Task | Message> {
    const address = typeof targetAddress === "string" ? targetAddress.trim() : ""
    if (!address || address.length > 256) {
      throw new A2AError("targetAddress must be 1-256 characters", "INVALID_TARGET_ADDRESS")
    }

    // Verifies the sender's post-quantum signature, then processes the message locally.
    const result = await this.sendMessage(request)
    if (!("status" in result) || !("id" in result)) return result

    // The open platform does not route over AetherNet; live routing is AetherNet QUAS.
    // The task records that honestly, with a platform attestation when a platform key is configured.
    const attestation = await attest("a2a.aethernet.bridge", {
      targetAddress: address,
      taskId: result.id,
      contextId: result.contextId,
    })
    const metadata = {
      ...(result.metadata ?? {}),
      aethernet: {
        targetAddress: address,
        routed: false,
        note: "Processed locally. Live AetherNet routing and post-quantum encryption in transit are AetherNet QUAS.",
        attestation,
      },
    }
    const { error } = await this.supabase
      .from("a2a_tasks")
      .update({ metadata })
      .eq("task_id", result.id)
      .eq("user_id", this.userId)
    if (error) {
      console.error("[A2A] Failed to record AetherNet bridge metadata:", error.message)
      return result
    }
    return { ...result, metadata }
  }

  /**
   * Verifies an optional ML-DSA-65 signature carried in message.metadata.pqcSignature.
   * Returns the verification record stored with the message.
   */
  private async verifyMessageSignature(message: Message): Promise<Record<string, unknown>> {
    const raw = message.metadata?.pqcSignature
    try {
      if (raw !== undefined && raw !== null && !message.messageId) {
        throw new PqcError("A signed message must carry its own messageId", "PQC_MESSAGE_ID_REQUIRED")
      }
      const result = await verifySender({
        supabase: this.supabase,
        userId: this.userId,
        domain: "a2a.message",
        body: a2aMessageBody({ ...message, messageId: message.messageId ?? "" }),
        signature: raw,
      })
      if (result.status === "unsigned") return { status: "unsigned" }

      const { data: seen } = await this.supabase
        .from("a2a_messages")
        .select("id")
        .eq("user_id", this.userId)
        .eq("message_id", message.messageId)
        .limit(1)
      if (seen?.length) throw new PqcError("This signed message was already received", "PQC_REPLAY")

      return { status: "verified", keyId: result.keyId, alg: result.alg, signedAt: result.signedAt }
    } catch (error) {
      if (error instanceof PqcError) throw new A2AError(error.message, error.code)
      throw error
    }
  }

  // ==========================================================================
  // HELPERS
  // ==========================================================================

  private mapDbToAgentCard(db: any): AgentCard {
    return {
      agentId: db.agent_id,
      name: db.name,
      description: db.description,
      url: db.url,
      protocolVersions: db.protocol_versions || ["1.0"],
      capabilities: db.capabilities || {},
      skills: db.skills || [],
      securitySchemes: db.security_schemes,
      security: db.security,
      defaultInputModes: db.default_input_modes,
      defaultOutputModes: db.default_output_modes,
      provider: db.provider,
      documentationUrl: db.documentation_url,
    }
  }

  private mapDbToTask(db: any, historyLength?: number): Task {
    let history = db.a2a_messages || db.history || []
    if (historyLength !== undefined && historyLength > 0) {
      history = history.slice(-historyLength)
    } else if (historyLength === 0) {
      history = []
    }

    return {
      id: db.task_id,
      contextId: db.context_id,
      status: db.status || { state: db.current_state },
      history: history.map((m: any) => ({
        messageId: m.message_id || m.messageId,
        role: m.role,
        parts: m.parts,
        referenceTaskIds: m.reference_task_ids || m.referenceTaskIds,
        contextId: m.context_id || m.contextId,
        metadata: m.metadata,
        extensions: m.extensions,
      })),
      artifacts: (db.a2a_artifacts || db.artifacts || []).map((a: any) => ({
        artifactId: a.artifact_id || a.artifactId,
        name: a.name,
        description: a.description,
        parts: a.parts,
        index: a.artifact_index || a.index,
        append: a.append,
        lastChunk: a.last_chunk || a.lastChunk,
        metadata: a.metadata,
        extensions: a.extensions,
      })),
      metadata: db.metadata,
    }
  }

  private async logA2ARequest(taskId: string, contextId: string, request: SendMessageRequest) {
    try {
      await this.supabase
        .from("ai_request_logs")
        .insert({
          user_id: this.userId,
          request_type: "a2a_message",
          agent_id: this.agentCardId,
          input: JSON.stringify(request.message),
          metadata: {
            task_id: taskId,
            context_id: contextId,
            protocol_version: this.protocolVersion,
          },
          status: "pending",
        })
    } catch (err) {
      console.error("[Kronova A2A] Failed to log request:", err)
    }
  }
}

// ============================================================================
// FACTORY FUNCTION
// ============================================================================

export function createKronovaA2AClient(config: KronovaA2AClientConfig): KronovaA2AClient {
  return new KronovaA2AClient(config)
}
