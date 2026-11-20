/**
 * Nine skills that were stubs and now run against real tables or real outbound calls:
 * ai_agent_deployment, workflow_automation_builder, aethernet_p2p_communication,
 * voice_agent_interface, accessibility_compliance_scanner, iot_device_coordination,
 * autonomous_system_protocol, edge_computing_coordinator, hybrid_cloud_orchestrator.
 *
 * Rules shared with data-skills.ts:
 *  - Every query is scoped to ctx.userId.
 *  - Writes only happen when ctx.confirm is true; otherwise the skill returns a dry run.
 *  - Skills that record configuration (agents, workflows, messages) are "preview": the
 *    record is real, but nothing executes or delivers it yet, and the output says so.
 */

import { lookup } from "node:dns/promises"
import net from "node:net"
import { SkillError, type SkillContext, type SkillDefinition, type SkillOutput } from "./types"
import { AUDIO_INPUT_PROPERTIES, resolveVoiceCommand } from "./transcription"
import { PqcError, attest, verifySender } from "@/lib/pqc/service"
import { aethernetMessageBody } from "@/lib/pqc/sign"
import {
  assetUtilization,
  complianceMonitoring,
  dbError,
  daysSince,
  findAsset,
  predictiveMaintenance,
  round,
  voiceDataEntry,
  type AssetRow,
} from "./data-skills"

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const HOUR_MS = 3_600_000

const str = (description: string, extra: Record<string, unknown> = {}) => ({ type: "string" as const, description, ...extra })

// ---------------------------------------------------------------------------
// 1. ai_agent_deployment
// ---------------------------------------------------------------------------

const AGENT_TEMPLATES: Record<string, { label: string; description: string; skills: string[] }> = {
  maintenance_monitor: {
    label: "Maintenance Monitor",
    description: "Reviews maintenance risk for the assigned assets.",
    skills: ["predictive_maintenance_analysis"],
  },
  cost_optimizer: {
    label: "Cost Optimizer",
    description: "Reviews utilization and recorded costs for the assigned assets.",
    skills: ["asset_utilization_optimizer", "financial_data_integration_engine"],
  },
  compliance_auditor: {
    label: "Compliance Auditor",
    description: "Checks recorded compliance data for the assigned assets.",
    skills: ["compliance_monitoring_system"],
  },
  utilization_analyst: {
    label: "Utilization Analyst",
    description: "Reviews operating status and telemetry recency for the assigned assets.",
    skills: ["asset_utilization_optimizer"],
  },
}

export const aiAgentDeployment: SkillDefinition = {
  id: "ai_agent_deployment",
  name: "AI agent deployment",
  description:
    "Registers an agent configuration for your assets: an agent record bound to the skills for its role plus the assets it should watch. Previews the record unless confirm is set.",
  category: "Agent and workflow automation",
  tags: ["agents", "deployment"],
  status: "preview",
  mutates: true,
  dataSources: ["assets", "ai_agents", "asset_agent_configs"],
  limitations:
    "The agent is stored inactive. There is no scheduler that runs agents, so registering one does not start monitoring. autonomous_mode is rejected for the same reason.",
  examples: ['{"agent_type":"maintenance_monitor","target_assets":["FL-12"]}'],
  inputSchema: {
    type: "object",
    required: ["agent_type"],
    properties: {
      agent_type: str("Type of AI agent to register", { enum: Object.keys(AGENT_TEMPLATES) }),
      target_assets: { type: "array", description: "Asset uuids, tags, QR codes, NFC tags or exact names (max 25)", items: { type: "string" } },
      autonomous_mode: { type: "boolean", default: false },
    },
  },
  async run(input, ctx) {
    if (input.autonomous_mode) {
      throw new SkillError("UNSUPPORTED", "autonomous_mode is not available: nothing executes agents yet, so an autonomous agent could not act.")
    }
    const template = AGENT_TEMPLATES[input.agent_type]
    const refs: string[] = [...new Set<string>((input.target_assets ?? []).map((ref: string) => ref.trim()).filter(Boolean))]
    if (refs.length > 25) throw new SkillError("INVALID_INPUT", "target_assets accepts at most 25 assets")

    const found = await Promise.all(refs.map((ref) => findAsset(ctx, ref)))
    const targets = [...new Map(found.map((asset) => [asset.id, asset])).values()]

    const { count, error: countError } = await ctx.supabase
      .from("ai_agents")
      .select("id", { count: "exact", head: true })
      .eq("user_id", ctx.userId)
      .eq("template_id", input.agent_type)
    if (countError) throw dbError("Failed to check existing agents", countError)
    const name = count ? `${template.label} #${count + 1}` : template.label

    const agentRow = {
      user_id: ctx.userId,
      name,
      description: template.description,
      category: "asset_management",
      template_id: input.agent_type,
      is_active: false,
      tools: template.skills,
      parameters: { autonomous_mode: false, created_via: "ai_agent_deployment", target_asset_ids: targets.map((a) => a.id) },
    }
    const warnings = [
      "Registered inactive: no scheduler runs agents, so this does not start monitoring.",
      ...(targets.length === 0 ? ["No target_assets given; the agent is not bound to any asset."] : []),
    ]
    const preview = {
      agent: { name, template: input.agent_type, skills: template.skills, is_active: false },
      target_assets: targets.map((a) => ({ id: a.id, name: a.name })),
    }

    if (!ctx.confirm) {
      return {
        summary: `Would register "${name}" for ${targets.length} asset(s). Set confirm to create it.`,
        dryRun: true,
        warnings,
        dataSources: this.dataSources,
        data: { ...preview, would_write: agentRow },
      }
    }

    const { data: agent, error } = await ctx.supabase.from("ai_agents").insert(agentRow).select("id, name").single()
    if (error) throw dbError("Failed to create agent", error)
    const { error: configError } = await ctx.supabase.from("asset_agent_configs").insert({
      agent_id: agent.id,
      user_id: ctx.userId,
      template_id: input.agent_type,
      target_assets: targets.map((a) => a.id),
      auto_insights: false,
      notification_threshold: "medium",
    })
    if (configError) {
      await ctx.supabase.from("ai_agents").delete().eq("id", agent.id).eq("user_id", ctx.userId)
      throw dbError("Failed to bind agent to assets", configError)
    }

    return {
      summary: `Registered "${agent.name}" (inactive) for ${targets.length} asset(s).`,
      warnings,
      dataSources: this.dataSources,
      data: { ...preview, agent_id: agent.id, registered: true },
    }
  },
}

// ---------------------------------------------------------------------------
// 2. workflow_automation_builder
// ---------------------------------------------------------------------------

const ACTION_NAME = /^[a-z][a-z0-9_]{1,63}$/
const MAX_WORKFLOW_BYTES = 20_000

export const workflowAutomationBuilder: SkillDefinition = {
  id: "workflow_automation_builder",
  name: "Workflow automation builder",
  description:
    "Validates and stores a multi-step asset workflow definition. Each step is an object with a snake_case `action`. Previews the definition unless confirm is set.",
  category: "Agent and workflow automation",
  tags: ["workflows", "automation"],
  status: "preview",
  mutates: true,
  dataSources: ["asset_workflows"],
  limitations:
    "Stores the definition inactive. There is no step executor or trigger scheduler yet, so workflows are not run automatically.",
  examples: ['{"workflow_name":"Quarterly inspection","trigger_type":"scheduled","steps":[{"action":"schedule_inspection"},{"action":"notify_owner"}]}'],
  inputSchema: {
    type: "object",
    required: ["workflow_name", "steps"],
    properties: {
      workflow_name: str("Name of the workflow", { maxLength: 120 }),
      steps: { type: "array", description: "Workflow steps (1-25 objects, each with an `action`)", items: { type: "object" } },
      trigger_type: str("How the workflow is triggered", { enum: ["scheduled", "event_based", "manual"], default: "manual" }),
    },
  },
  async run(input, ctx) {
    const name: string = input.workflow_name.trim()
    if (!name) throw new SkillError("INVALID_INPUT", "workflow_name is empty")
    const steps: unknown[] = input.steps
    if (steps.length < 1 || steps.length > 25) throw new SkillError("INVALID_INPUT", "A workflow needs between 1 and 25 steps")

    const issues: string[] = []
    steps.forEach((step, index) => {
      if (!step || typeof step !== "object" || Array.isArray(step)) issues.push(`Step ${index + 1} must be an object`)
      else if (typeof (step as any).action !== "string" || !ACTION_NAME.test((step as any).action)) {
        issues.push(`Step ${index + 1} needs a snake_case "action" (2-64 characters)`)
      }
    })
    if (JSON.stringify(steps).length > MAX_WORKFLOW_BYTES) issues.push("Steps are too large (limit 20 KB)")
    if (issues.length) throw new SkillError("INVALID_INPUT", "Workflow definition is invalid", { issues })

    const { data: existing, error: existingError } = await ctx.supabase
      .from("asset_workflows")
      .select("id")
      .eq("user_id", ctx.userId)
      .eq("name", name)
      .limit(1)
    if (existingError) throw dbError("Failed to check existing workflows", existingError)
    if (existing?.length) throw new SkillError("AMBIGUOUS", `A workflow named "${name}" already exists`, { workflow_id: existing[0].id })

    const row = {
      user_id: ctx.userId,
      name,
      description: "Created via workflow_automation_builder",
      trigger_type: input.trigger_type,
      trigger_config: { type: input.trigger_type, source: "workflow_automation_builder" },
      steps,
      is_active: false,
    }
    const warnings = ["Stored inactive: there is no step executor or trigger scheduler yet, so this workflow will not run on its own."]
    const summaryData = { name, trigger_type: input.trigger_type, step_count: steps.length, actions: steps.map((s: any) => s.action) }

    if (!ctx.confirm) {
      return {
        summary: `Workflow "${name}" is valid (${steps.length} steps). Set confirm to store it.`,
        dryRun: true,
        warnings,
        dataSources: this.dataSources,
        data: { ...summaryData, valid: true, would_write: row },
      }
    }

    const { data, error } = await ctx.supabase.from("asset_workflows").insert(row).select("id, name").single()
    if (error) throw dbError("Failed to store workflow", error)
    return {
      summary: `Stored workflow "${data.name}" (inactive, ${steps.length} steps).`,
      warnings,
      dataSources: this.dataSources,
      data: { ...summaryData, valid: true, workflow_id: data.id, stored: true },
    }
  },
}

// ---------------------------------------------------------------------------
// 3. aethernet_p2p_communication
// ---------------------------------------------------------------------------

const AETHERNET_TYPES: Record<string, { messageType: "standard" | "alert"; priority: "normal" | "high" }> = {
  data_sync: { messageType: "standard", priority: "normal" },
  task_delegation: { messageType: "standard", priority: "normal" },
  insight_share: { messageType: "standard", priority: "normal" },
  alert: { messageType: "alert", priority: "high" },
}
const MAX_PAYLOAD_BYTES = 8_000

export const aethernetMessaging: SkillDefinition = {
  id: "aethernet_p2p_communication",
  name: "AetherNet peer-to-peer messaging",
  description:
    "Records an addressed message between two of your agents on the open AetherNet message tables. Previews the message unless confirm is set.",
  category: "Agent and workflow automation",
  tags: ["aethernet", "messaging"],
  status: "preview",
  mutates: true,
  dataSources: ["ai_agents", "entities", "aethernet_messages", "aethernet_message_recipients"],
  limitations:
    "Records the message and its recipient as pending. Optional ML-DSA-65 sender signatures are verified and stored, and the platform countersigns when a platform key is configured. Live routing, delivery and post-quantum encryption are AetherNet QUAS (commercial); the open platform does not deliver or encrypt it. Both agents must be yours.",
  examples: ['{"source_agent_id":"<agent uuid>","target_agent_id":"<agent uuid>","message_type":"insight_share","payload":{"note":"Pump 4 vibration trend"}}'],
  inputSchema: {
    type: "object",
    required: ["source_agent_id", "target_agent_id", "message_type"],
    properties: {
      source_agent_id: str("Sending agent uuid (an ai_agents row you own)"),
      target_agent_id: str("Receiving agent uuid (an ai_agents row you own)"),
      message_type: str("Type of inter-agent communication", { enum: Object.keys(AETHERNET_TYPES) }),
      payload: { type: "object", description: "Data to transmit (max 8 KB)" },
      pqc_signature: {
        type: "object",
        description:
          "Optional ML-DSA-65 sender signature {alg, keyId, signedAt, signature} over {sourceAgentId, targetAgentId, messageType, payload} in the aethernet.message domain. Required once your account has registered a key.",
      },
    },
  },
  async run(input, ctx) {
    for (const key of ["source_agent_id", "target_agent_id"] as const) {
      if (!UUID.test(input[key])) throw new SkillError("INVALID_INPUT", `${key} must be an agent uuid`)
    }
    if (input.source_agent_id === input.target_agent_id) throw new SkillError("INVALID_INPUT", "source and target agents must differ")
    const payload = input.payload ?? {}
    if (JSON.stringify(payload).length > MAX_PAYLOAD_BYTES) throw new SkillError("INVALID_INPUT", "payload is too large (limit 8 KB)")

    const { data: agents, error: agentError } = await ctx.supabase
      .from("ai_agents")
      .select("id, name")
      .eq("user_id", ctx.userId)
      .in("id", [input.source_agent_id, input.target_agent_id])
    if (agentError) throw dbError("Failed to look up agents", agentError)
    const source = agents?.find((a: any) => a.id === input.source_agent_id)
    const target = agents?.find((a: any) => a.id === input.target_agent_id)
    if (!source) throw new SkillError("NOT_FOUND", "source_agent_id is not one of your agents")
    if (!target) throw new SkillError("NOT_FOUND", "target_agent_id is not one of your agents")

    let sender: Awaited<ReturnType<typeof verifySender>>
    try {
      sender = await verifySender({
        supabase: ctx.supabase,
        userId: ctx.userId,
        domain: "aethernet.message",
        body: aethernetMessageBody({
          source_agent_id: input.source_agent_id,
          target_agent_id: input.target_agent_id,
          message_type: input.message_type,
          payload: input.payload,
        }),
        signature: input.pqc_signature,
      })
    } catch (error) {
      if (error instanceof PqcError) throw new SkillError("INVALID_INPUT", error.message, { pqc_code: error.code })
      throw error
    }
    if (sender.status === "verified") {
      const { data: replay } = await ctx.supabase
        .from("aethernet_message_recipients")
        .select("id")
        .eq("signature", sender.signature)
        .limit(1)
      if (replay?.length) throw new SkillError("INVALID_INPUT", "This signed message was already recorded", { pqc_code: "PQC_REPLAY" })
    }
    const senderRecord = sender.status === "verified" ? { status: "verified", keyId: sender.keyId, alg: sender.alg, signedAt: sender.signedAt } : { status: "unsigned" }

    const kind = AETHERNET_TYPES[input.message_type]
    const messageId = crypto.randomUUID()
    const message = {
      id: messageId,
      sender_id: source.id,
      status: "sent",
      priority: kind.priority,
      message_type: kind.messageType,
      encrypted: false,
      metadata: {
        kind: input.message_type,
        source_agent_id: source.id,
        target_agent_id: target.id,
        payload,
        via: "aethernet_p2p_communication",
        pqc: { sender: senderRecord } as Record<string, unknown>,
      },
      protocol_version: "1.0",
    }
    const warnings = [
      "Recorded as pending and unencrypted. The open platform does not route or deliver AetherNet messages; that is AetherNet QUAS.",
      sender.status === "verified"
        ? `Sender signature verified (${sender.keyId}). The signature authenticates the sender; it does not encrypt the payload.`
        : "Unsigned message: sender is authenticated by API key only. Register a post-quantum key to require signatures.",
    ]
    const preview = { from: { id: source.id, name: source.name }, to: { id: target.id, name: target.name }, kind: input.message_type }

    if (!ctx.confirm) {
      return {
        summary: `Would record a ${input.message_type} message from ${source.name} to ${target.name}. Set confirm to record it.`,
        dryRun: true,
        warnings,
        dataSources: this.dataSources,
        data: { ...preview, would_write: message },
      }
    }

    // sender_id and recipient_id reference entities(id), not ai_agents, so each agent is mirrored under its own uuid.
    const { error: entityError } = await ctx.supabase.from("entities").upsert(
      [source, target].map((agent: any) => ({
        id: agent.id,
        entity_type: "agent",
        name: agent.name,
        metadata: { user_id: ctx.userId, ai_agent_id: agent.id },
      })),
      { onConflict: "id", ignoreDuplicates: true },
    )
    if (entityError) throw dbError("Failed to register agents on AetherNet", entityError)

    const attestation = await attest("aethernet.attestation", {
      messageId,
      senderId: source.id,
      recipientId: target.id,
      messageType: input.message_type,
      payload,
    })
    message.metadata.pqc.attestation = attestation

    const { data: saved, error } = await ctx.supabase.from("aethernet_messages").insert(message).select("id").single()
    if (error) throw dbError("Failed to record message", error)
    const { error: recipientError } = await ctx.supabase.from("aethernet_message_recipients").insert({
      aethernet_message_id: saved.id,
      recipient_id: target.id,
      status: "sent",
      recipient_type: "to",
      delivery_status: "pending",
      read_status: "unread",
      signature: sender.status === "verified" ? sender.signature : null,
      sender_key_id: sender.status === "verified" ? sender.keyId : null,
    })
    if (recipientError) {
      await ctx.supabase.from("aethernet_messages").delete().eq("id", saved.id).eq("sender_id", source.id)
      throw dbError("Failed to address message", recipientError)
    }
    return {
      summary: `Recorded ${input.message_type} message from ${source.name} to ${target.name} (delivery pending).`,
      warnings,
      dataSources: this.dataSources,
      data: {
        ...preview,
        message_id: saved.id,
        delivery_status: "pending",
        recorded: true,
        pqc: { sender: senderRecord, attested: Boolean(attestation) },
      },
    }
  },
}

// ---------------------------------------------------------------------------
// 4. voice_agent_interface
// ---------------------------------------------------------------------------

const SPEECH_CHARS = 240
// George, a premade voice. Library voices (e.g. Rachel) are rejected with 402 on free ElevenLabs plans.
const DEFAULT_VOICE_ID = "JBFqnCBsd6RMkjVDRZzb"

async function synthesizeSpeech(text: string): Promise<{ mime: string; base64: string; characters: number } | { error: string }> {
  const apiKey = process.env.ELEVENLABS_API_KEY
  if (!apiKey) return { error: "Speech synthesis is not configured on this deployment." }
  const spoken = text.length > SPEECH_CHARS ? `${text.slice(0, SPEECH_CHARS).replace(/\s+\S*$/, "")}.` : text
  try {
    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${process.env.ELEVENLABS_VOICE_ID ?? DEFAULT_VOICE_ID}?output_format=mp3_22050_32`,
      {
        method: "POST",
        headers: { "xi-api-key": apiKey, "Content-Type": "application/json", Accept: "audio/mpeg" },
        body: JSON.stringify({ text: spoken, model_id: "eleven_turbo_v2_5" }),
        signal: AbortSignal.timeout(8_000),
      },
    )
    if (!response.ok) {
      const detail = await response.json().catch(() => null) as { detail?: { code?: string } } | null
      const code = detail?.detail?.code
      return { error: `Speech synthesis failed (HTTP ${response.status}${code ? `, ${code}` : ""}).` }
    }
    const audio = Buffer.from(await response.arrayBuffer())
    return { mime: "audio/mpeg", base64: audio.toString("base64"), characters: spoken.length }
  } catch {
    return { error: "Speech synthesis timed out or was unreachable." }
  }
}

export const voiceAgentInterface: SkillDefinition = {
  id: "voice_agent_interface",
  name: "Voice agent interface",
  description:
    "Takes a spoken or typed command, routes it to the matching skill (log an event, utilization, compliance, maintenance risk) and optionally returns the answer as ElevenLabs speech. Send voice_command as text or audio_base64 as audio, which is transcribed with ElevenLabs.",
  category: "Voice and accessibility",
  tags: ["voice", "elevenlabs", "speech-to-text", "text-to-speech"],
  status: "live",
  mutates: true,
  dataSources: ["assets", "iot_sensor_data", "asset_lifecycle_events", "elevenlabs"],
  limitations:
    "Audio in is limited to about 3 MB and is transcribed by ElevenLabs; the transcript is returned so it can be checked. Intent routing is keyword based and covers four intents; anything else is returned as not understood. Logging an event only writes when confirm is set. Speech covers the first ~240 characters of the answer.",
  examples: [
    '{"voice_command":"How is the risk on forklift FL-12?","response_mode":"both"}',
    '{"audio_base64":"<base64 audio of the same question>","response_mode":"text"}',
  ],
  inputSchema: {
    type: "object",
    required: [],
    properties: {
      voice_command: str("Transcribed natural language command. Send this or audio_base64.", { maxLength: 500 }),
      ...AUDIO_INPUT_PROPERTIES,
      context: str("Operational context", { maxLength: 100 }),
      response_mode: str("How to respond", { enum: ["voice", "text", "both"], default: "both" }),
    },
  },
  async run(input, ctx) {
    const resolved = await resolveVoiceCommand(input)
    const command = resolved.command
    const readOnly: SkillContext = { ...ctx, confirm: false }
    const assetRef = command.match(/\b(?:asset|forklift|truck|equipment|vehicle|pump)[\s#:-]*([a-z0-9][a-z0-9-]{1,40})\b/i)?.[1]

    let intent: string | null = null
    let result: SkillOutput | null = null
    if (/\b(log|logged|record|recorded|completed|finished|performed)\b/i.test(command)) {
      intent = "log_event"
      result = await voiceDataEntry.run!({ voice_command: command, context: input.context }, ctx)
    } else if (/\b(utili[sz]ation|idle|unused|underused)\b/i.test(command)) {
      intent = "utilization_review"
      result = await assetUtilization.run!({ scope: "organization", time_period_days: 30 }, readOnly)
    } else if (/\b(complian\w*|inspection|certif\w*|osha|iso)\b/i.test(command)) {
      intent = "compliance_check"
      result = await complianceMonitoring.run!({ regulation_types: ["All"], create_remediation_workflows: false }, readOnly)
    } else if (/\b(maintenance|risk|health|failure|how is)\b/i.test(command)) {
      intent = "maintenance_risk"
      if (assetRef) result = await predictiveMaintenance.run!({ asset_id: assetRef, create_workflow: false }, readOnly)
    }

    const warnings: string[] = [...resolved.warnings]
    let reply: string
    if (!intent) {
      reply = "I did not understand that. Try asking about utilization, compliance, maintenance risk for a named asset, or log a completed job."
    } else if (!result) {
      reply = "Which asset do you mean? Name it, for example forklift FL-12."
      warnings.push("The command matched maintenance risk but named no asset.")
    } else {
      reply = result.summary
      if (result.warnings) warnings.push(...result.warnings)
    }

    const data: Record<string, unknown> = {
      transcript: command,
      ...(resolved.transcription && { transcription: resolved.transcription }),
      intent,
      understood: Boolean(result),
      ...(input.response_mode !== "voice" && { text: reply }),
      ...(result && { result: result.data }),
    }
    if (input.response_mode !== "text") {
      const speech = await synthesizeSpeech(reply)
      if ("error" in speech) warnings.push(speech.error)
      else data.audio = speech
    }

    return {
      summary: reply,
      dryRun: result?.dryRun,
      warnings: warnings.length ? warnings : undefined,
      dataSources: this.dataSources,
      data,
    }
  },
}

// ---------------------------------------------------------------------------
// 5. accessibility_compliance_scanner
// ---------------------------------------------------------------------------

function isPrivateAddress(address: string): boolean {
  const version = net.isIP(address)
  if (version === 4) {
    const [a, b] = address.split(".").map(Number)
    return (
      a === 0 || a === 10 || a === 127 || a >= 224 ||
      (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) ||
      (a === 100 && b >= 64 && b <= 127) || (a === 198 && (b === 18 || b === 19)) || (a === 192 && b === 0)
    )
  }
  if (version === 6) {
    const value = address.toLowerCase()
    if (value === "::" || value === "::1" || value.startsWith("fc") || value.startsWith("fd") || /^fe[89ab]/.test(value)) return true
    const mapped = value.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/)
    return mapped ? isPrivateAddress(mapped[1]) : false
  }
  return true
}

async function assertPublicUrl(raw: string): Promise<URL> {
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    throw new SkillError("INVALID_INPUT", "target_url is not a valid URL")
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") throw new SkillError("INVALID_INPUT", "Only http and https URLs can be scanned")
  if (url.username || url.password) throw new SkillError("INVALID_INPUT", "URLs with credentials are not allowed")
  const host = url.hostname.replace(/^\[|\]$/g, "")
  const addresses = net.isIP(host) ? [{ address: host }] : await lookup(host, { all: true }).catch(() => [])
  if (!addresses.length) throw new SkillError("INVALID_INPUT", "target_url host could not be resolved")
  if (addresses.some((entry) => isPrivateAddress(entry.address))) {
    throw new SkillError("INVALID_INPUT", "target_url must be a public address; private and internal hosts are not scanned")
  }
  return url
}

const MAX_HTML_BYTES = 1_000_000

async function fetchPublicHtml(raw: string): Promise<{ html: string; finalUrl: string; status: number; truncated: boolean }> {
  let url = await assertPublicUrl(raw)
  for (let hop = 0; hop < 4; hop++) {
    const response = await fetch(url, {
      redirect: "manual",
      headers: { "User-Agent": "KronovaAccessibilityScanner/1.0", Accept: "text/html,application/xhtml+xml" },
      signal: AbortSignal.timeout(8_000),
    }).catch(() => {
      throw new SkillError("INVALID_INPUT", "target_url could not be fetched")
    })
    if (response.status >= 300 && response.status < 400 && response.headers.get("location")) {
      url = await assertPublicUrl(new URL(response.headers.get("location")!, url).toString())
      continue
    }
    const type = response.headers.get("content-type") ?? ""
    if (!/html/i.test(type)) throw new SkillError("UNSUPPORTED", `target_url returned ${type || "an unknown content type"}, not HTML`)
    const reader = response.body?.getReader()
    const chunks: Uint8Array[] = []
    let size = 0
    let truncated = false
    while (reader) {
      const { done, value } = await reader.read()
      if (done) break
      size += value.length
      chunks.push(value)
      if (size >= MAX_HTML_BYTES) {
        truncated = true
        await reader.cancel()
        break
      }
    }
    return { html: Buffer.concat(chunks).toString("utf8"), finalUrl: url.toString(), status: response.status, truncated }
  }
  throw new SkillError("INVALID_INPUT", "target_url redirected too many times")
}

interface Finding {
  rule: string
  wcag: string
  level: "A" | "AA"
  severity: "error" | "warning"
  count: number
  message: string
  examples: string[]
}

const attr = (tag: string, name: string) => tag.match(new RegExp(`\\s${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, "i"))
const hasAttr = (tag: string, name: string) => new RegExp(`\\s${name}(?:\\s|=|>|/)`, "i").test(tag)
const snippet = (text: string) => text.replace(/\s+/g, " ").slice(0, 120)
const plainText = (html: string) => html.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").trim()

export function scanHtml(html: string): { findings: Finding[]; checksRun: number } {
  const findings: Finding[] = []
  const add = (rule: string, wcag: string, level: "A" | "AA", severity: "error" | "warning", message: string, hits: string[]) => {
    if (hits.length) findings.push({ rule, wcag, level, severity, count: hits.length, message, examples: hits.slice(0, 3).map(snippet) })
  }
  const body = html.replace(/<script[\s\S]*?<\/script>/gi, "").replace(/<style[\s\S]*?<\/style>/gi, "").replace(/<!--[\s\S]*?-->/g, "")
  const tags = (name: string): string[] => body.match(new RegExp(`<${name}\\b[^>]*>`, "gi")) ?? []

  const htmlTag = tags("html")[0] ?? ""
  add("html-lang", "3.1.1", "A", "error", "The <html> element has no lang attribute.", htmlTag && attr(htmlTag, "lang")?.slice(1).some(Boolean) ? [] : ["<html>"])
  add("document-title", "2.4.2", "A", "error", "The page has no non-empty <title>.", /<title[^>]*>\s*\S[\s\S]*?<\/title>/i.test(body) ? [] : ["<head>"])
  add("image-alt", "1.1.1", "A", "error", "Images without an alt attribute.", tags("img").filter((t) => !hasAttr(t, "alt") && !/role\s*=\s*["']?(presentation|none)/i.test(t)))

  const labelBlocks = body.match(/<label\b[\s\S]*?<\/label>/gi) ?? []
  const labelFor = new Set(tags("label").map((t) => attr(t, "for")).map((m) => m?.slice(1).find(Boolean)).filter(Boolean))
  add(
    "form-label",
    "1.3.1",
    "A",
    "error",
    "Form controls without a label.",
    tags("input").concat(tags("select"), tags("textarea")).filter((t) => {
      const type = attr(t, "type")?.slice(1).find(Boolean)?.toLowerCase()
      if (type && ["hidden", "submit", "button", "reset", "image"].includes(type)) return false
      if (hasAttr(t, "aria-label") || hasAttr(t, "aria-labelledby") || hasAttr(t, "title")) return false
      const id = attr(t, "id")?.slice(1).find(Boolean)
      if (id && labelFor.has(id)) return false
      return !labelBlocks.some((block) => block.includes(t))
    }),
  )

  const named = (tagName: string, requireHref: boolean) =>
    [...body.matchAll(new RegExp(`<${tagName}\\b([^>]*)>([\\s\\S]*?)</${tagName}>`, "gi"))]
      .filter(([, attrs, inner]) => {
        if (requireHref && !/\shref\s*=/i.test(attrs)) return false
        if (/\saria-label(ledby)?\s*=/i.test(attrs) || /\stitle\s*=/i.test(attrs)) return false
        if (plainText(inner)) return false
        return !/<img\b[^>]*\salt\s*=\s*["'][^"']+["']/i.test(inner)
      })
      .map(([full]) => full)
  add("button-name", "4.1.2", "A", "error", "Buttons with no accessible name.", named("button", false))
  add("link-name", "2.4.4", "A", "error", "Links with no accessible name.", named("a", true))
  add("frame-title", "4.1.2", "A", "error", "Iframes without a title.", tags("iframe").filter((t) => !hasAttr(t, "title")))

  const viewport = tags("meta").find((t) => /name\s*=\s*["']viewport/i.test(t)) ?? ""
  add("meta-viewport", "1.4.4", "AA", "error", "Zoom is disabled by the viewport meta tag.", /user-scalable\s*=\s*(no|0)|maximum-scale\s*=\s*1(\.0)?\b/i.test(viewport) ? [viewport] : [])

  add("tabindex", "2.4.3", "A", "warning", "Positive tabindex values disrupt the natural focus order.", body.match(/<[^>]+\stabindex\s*=\s*["']?[1-9]\d*[^>]*>/gi) ?? [])
  add("autoplay", "1.4.2", "A", "warning", "Media that autoplays without being muted.", tags("video").concat(tags("audio")).filter((t) => hasAttr(t, "autoplay") && !hasAttr(t, "muted")))

  const ids = [...body.matchAll(/<[a-z][^>]*\sid\s*=\s*["']([^"']+)["']/gi)].map((m) => m[1])
  const seen = new Set<string>()
  add("duplicate-id", "4.1.1", "A", "warning", "Duplicate id values.", ids.filter((id) => (seen.has(id) ? true : (seen.add(id), false))))

  const headings = [...body.matchAll(/<h([1-6])\b/gi)].map((m) => Number(m[1]))
  add("heading-h1", "2.4.6", "AA", "warning", headings.filter((l) => l === 1).length === 0 ? "The page has no <h1>." : "The page has more than one <h1>.", headings.filter((l) => l === 1).length === 1 ? [] : ["<h1>"])
  add("heading-order", "1.3.1", "A", "warning", "Heading levels skip a level.", headings.filter((level, i) => i > 0 && level > headings[i - 1] + 1).map((l) => `<h${l}>`))
  add("landmark-main", "2.4.1", "A", "warning", "The page has no <main> landmark.", /<main\b|role\s*=\s*["']main["']/i.test(body) ? [] : ["<body>"])

  return { findings, checksRun: 14 }
}

export const accessibilityScanner: SkillDefinition = {
  id: "accessibility_compliance_scanner",
  name: "Accessibility compliance scanner",
  description:
    "Fetches a public URL and runs 14 automated WCAG 2.1 checks on its HTML (language, title, alt text, labels, names, zoom, focus order, headings, landmarks, duplicate ids).",
  category: "Voice and accessibility",
  tags: ["accessibility", "wcag"],
  status: "live",
  mutates: false,
  dataSources: ["http-fetch"],
  limitations:
    "Static HTML only: JavaScript is not executed, so client-rendered pages may show false findings, and colour contrast, keyboard behaviour and screen-reader output are not tested. Automated checks cannot certify WCAG conformance. Only public http(s) hosts are fetched.",
  examples: ['{"target_url":"https://example.com","compliance_level":"AA"}'],
  inputSchema: {
    type: "object",
    required: ["target_url"],
    properties: {
      target_url: str("Public http(s) URL to scan", { maxLength: 2000 }),
      compliance_level: str("WCAG level", { enum: ["A", "AA", "AAA"], default: "AA" }),
      generate_report: { type: "boolean", default: true, description: "Include every finding with examples. False returns counts only." },
    },
  },
  async run(input) {
    const page = await fetchPublicHtml(input.target_url)
    const { findings: all, checksRun } = scanHtml(page.html)
    const findings = input.compliance_level === "A" ? all.filter((f) => f.level === "A") : all
    const errors = findings.filter((f) => f.severity === "error").length
    const warnings = findings.filter((f) => f.severity === "warning").length

    const notes = [
      "Automated checks only; a clean result does not mean the page conforms to WCAG.",
      ...(input.compliance_level === "AAA" ? ["No additional automated AAA checks exist; AAA results match AA."] : []),
      ...(page.truncated ? ["Page exceeded 1 MB; only the first 1 MB was scanned."] : []),
    ]
    return {
      summary: `${page.finalUrl}: ${errors} error rule(s) and ${warnings} warning rule(s) across ${checksRun} automated checks.`,
      warnings: notes,
      dataSources: this.dataSources,
      data: {
        url: page.finalUrl,
        http_status: page.status,
        target_level: input.compliance_level,
        checks_run: checksRun,
        counts: { error_rules: errors, warning_rules: warnings, total_instances: findings.reduce((n, f) => n + f.count, 0) },
        ...(input.generate_report && { findings }),
      },
    }
  },
}

// ---------------------------------------------------------------------------
// 6. iot_device_coordination
// ---------------------------------------------------------------------------

const SENSOR_TYPES = ["temperature", "humidity", "battery"]

export const iotDeviceCoordination: SkillDefinition = {
  id: "iot_device_coordination",
  name: "IoT device coordination",
  description:
    "Monitoring view of IoT devices you own: sensors attached to your assets and fleet devices, with latest temperature, humidity, battery and freshness.",
  category: "IoT and devices",
  tags: ["iot", "sensors"],
  status: "live",
  mutates: false,
  dataSources: ["assets", "iot_sensors", "iot_sensor_data", "iot_fleet_devices"],
  limitations:
    "Read-only monitoring. control and data_sync modes are rejected because there is no device gateway to send commands or sync state. Only temperature, humidity and battery are stored.",
  examples: ['{"device_ids":["SENSOR-001"],"coordination_mode":"monitoring"}'],
  inputSchema: {
    type: "object",
    required: ["device_ids", "coordination_mode"],
    properties: {
      device_ids: { type: "array", description: "Sensor ids on your assets, or fleet device ids (max 50)", items: { type: "string" } },
      coordination_mode: str("Coordination operation", { enum: ["monitoring", "control", "data_sync"] }),
      sensor_types: { type: "array", description: "Subset of: temperature, humidity, battery", items: { type: "string" } },
    },
  },
  async run(input, ctx) {
    if (input.coordination_mode !== "monitoring") {
      throw new SkillError("UNSUPPORTED", `coordination_mode "${input.coordination_mode}" is not available: there is no device gateway to control or sync devices. Use "monitoring".`)
    }
    const ids: string[] = [...new Set<string>(input.device_ids.map((id: string) => id.trim()).filter(Boolean))]
    if (!ids.length || ids.length > 50) throw new SkillError("INVALID_INPUT", "device_ids needs between 1 and 50 ids")
    const wanted: string[] = input.sensor_types?.length ? input.sensor_types : SENSOR_TYPES
    const unsupported = wanted.filter((type) => !SENSOR_TYPES.includes(type))
    const warnings = unsupported.length ? [`Not stored, so not reported: ${unsupported.join(", ")}.`] : []

    const [{ data: assets, error: assetError }, { data: fleet, error: fleetError }] = await Promise.all([
      ctx.supabase.from("assets").select("id, name, iot_sensor_id").eq("user_id", ctx.userId).in("iot_sensor_id", ids),
      ctx.supabase
        .from("iot_fleet_devices")
        .select("device_id, device_name, device_type, status, last_seen, maintenance_status")
        .eq("user_id", ctx.userId)
        .in("device_id", ids),
    ])
    if (assetError) throw dbError("Failed to read assets", assetError)
    if (fleetError) throw dbError("Failed to read fleet devices", fleetError)

    const assetIds = (assets ?? []).map((a: AssetRow) => a.id)
    const sensorIds = (assets ?? []).map((a: AssetRow) => a.iot_sensor_id)
    const [readings, sensors] = await Promise.all([
      assetIds.length
        ? ctx.supabase
            .from("iot_sensor_data")
            .select("asset_id, timestamp, temperature, humidity, battery_level")
            .in("asset_id", assetIds)
            .order("timestamp", { ascending: false })
            .limit(Math.min(1000, assetIds.length * 20))
        : { data: [], error: null },
      sensorIds.length
        ? ctx.supabase.from("iot_sensors").select("sensor_id, device_type, status, battery_level, last_reading").in("sensor_id", sensorIds)
        : { data: [], error: null },
    ])
    if (readings.error) throw dbError("Failed to read telemetry", readings.error)
    if (sensors.error) throw dbError("Failed to read sensors", sensors.error)

    const latestByAsset = new Map<string, any>()
    for (const row of readings.data ?? []) if (!latestByAsset.has(row.asset_id)) latestByAsset.set(row.asset_id, row)
    const sensorById = new Map<string, any>((sensors.data ?? []).map((s: any) => [s.sensor_id, s]))

    const freshness = (timestamp: string | null | undefined) => {
      if (!timestamp) return "no_data"
      const age = Date.now() - new Date(timestamp).getTime()
      return age <= HOUR_MS ? "fresh" : age <= 24 * HOUR_MS ? "recent" : "stale"
    }

    const devices: Record<string, unknown>[] = []
    const matched = new Set<string>()
    for (const asset of assets ?? []) {
      matched.add(asset.iot_sensor_id)
      const latest = latestByAsset.get(asset.id)
      const sensor = sensorById.get(asset.iot_sensor_id)
      devices.push({
        device_id: asset.iot_sensor_id,
        kind: "asset_sensor",
        asset: { id: asset.id, name: asset.name },
        registered_status: sensor?.status ?? null,
        freshness: freshness(latest?.timestamp ?? sensor?.last_reading),
        latest_reading: latest
          ? {
              timestamp: latest.timestamp,
              ...(wanted.includes("temperature") && { temperature: latest.temperature }),
              ...(wanted.includes("humidity") && { humidity: latest.humidity }),
              ...(wanted.includes("battery") && { battery_level: latest.battery_level ?? sensor?.battery_level ?? null }),
            }
          : null,
      })
    }
    for (const device of fleet ?? []) {
      matched.add(device.device_id)
      devices.push({
        device_id: device.device_id,
        kind: "fleet_device",
        name: device.device_name,
        device_type: device.device_type,
        registered_status: device.status,
        freshness: freshness(device.last_seen),
        last_seen: device.last_seen,
        maintenance_status: device.maintenance_status,
      })
    }
    const unregistered = ids.filter((id) => !matched.has(id))
    for (const id of unregistered) devices.push({ device_id: id, kind: "unregistered", freshness: "no_data" })
    if (unregistered.length) warnings.push(`${unregistered.length} id(s) are not registered to your account.`)

    const count = (state: string) => devices.filter((d) => d.freshness === state).length
    return {
      summary: `${devices.length - unregistered.length} of ${ids.length} device(s) found: ${count("fresh")} fresh, ${count("recent")} recent, ${count("stale")} stale, ${count("no_data")} with no data.`,
      warnings: warnings.length ? warnings : undefined,
      dataSources: this.dataSources,
      data: { mode: "monitoring", devices, freshness_rules: "fresh <= 1h, recent <= 24h, stale otherwise" },
    }
  },
}

// ---------------------------------------------------------------------------
// 7. autonomous_system_protocol
// ---------------------------------------------------------------------------

const RISK_FLAG_THRESHOLD: Record<string, number> = { low: 0.3, medium: 0.5, high: 0.7 }
const RISKY_STATUSES = ["faulty", "fault", "error", "down", "offline", "maintenance", "needs_repair"]

const normalizeRisk = (value: unknown): number => {
  const n = Number(value)
  if (!Number.isFinite(n) || n <= 0) return 0
  return Math.min(1, n > 1 ? n / 100 : n)
}

export const autonomousSystemProtocol: SkillDefinition = {
  id: "autonomous_system_protocol",
  name: "Autonomous system protocol",
  description:
    "Advisory task prioritization: ranks your assets by stored risk score, operating status and battery level so an operator or system can decide what to attend to first. It never actuates anything.",
  category: "IoT and devices",
  tags: ["autonomy", "prioritization", "advisory"],
  status: "live",
  mutates: false,
  dataSources: ["assets", "ai_agents"],
  limitations:
    "Only decision_type task_prioritization is supported, and only as a ranked recommendation. route_optimization, resource_allocation and emergency_response need a safety-reviewed decision engine and an actuation channel, and are rejected. The ranking is a transparent heuristic, not a learned policy.",
  examples: ['{"system_id":"warehouse-bot-1","decision_type":"task_prioritization","risk_tolerance":"low","constraints":{"limit":5}}'],
  inputSchema: {
    type: "object",
    required: ["system_id", "decision_type"],
    properties: {
      system_id: str("Autonomous system identifier (free text, or one of your agent uuids)", { maxLength: 100 }),
      decision_type: str("Type of decision", { enum: ["route_optimization", "task_prioritization", "resource_allocation", "emergency_response"] }),
      constraints: { type: "object", description: "Optional: { limit: 1-50 } number of ranked items" },
      risk_tolerance: str("Acceptable risk level", { enum: ["low", "medium", "high"], default: "medium" }),
    },
  },
  async run(input, ctx) {
    if (input.decision_type !== "task_prioritization") {
      throw new SkillError(
        "UNSUPPORTED",
        `decision_type "${input.decision_type}" is not available. Safety-relevant autonomous decisions need a reviewed decision engine; only advisory task_prioritization is supported.`,
      )
    }
    const limit = Math.min(50, Math.max(1, Number.isInteger(input.constraints?.limit) ? input.constraints.limit : 10))
    const threshold = RISK_FLAG_THRESHOLD[input.risk_tolerance]

    const { data, error } = await ctx.supabase
      .from("assets")
      .select("id, name, asset_type, operational_status, risk_score, battery_level")
      .eq("user_id", ctx.userId)
      .limit(500)
    if (error) throw dbError("Failed to read assets", error)

    const ranked = (data ?? [])
      .map((asset: AssetRow) => {
        const reasons: string[] = []
        const risk = normalizeRisk(asset.risk_score)
        let score = risk
        if (risk > 0) reasons.push(`stored risk score ${round(risk)}`)
        if (RISKY_STATUSES.includes(String(asset.operational_status ?? "").toLowerCase())) {
          score += 0.3
          reasons.push(`operational status "${asset.operational_status}"`)
        }
        const battery = Number(asset.battery_level)
        if (asset.battery_level !== null && Number.isFinite(battery) && battery < 20) {
          score += 0.2
          reasons.push(`battery ${battery}%`)
        }
        return { asset_id: asset.id, name: asset.name, asset_type: asset.asset_type, priority_score: round(Math.min(1.5, score)), reasons }
      })
      .filter((item: { priority_score: number }) => item.priority_score > 0)
      .sort((a: { priority_score: number }, b: { priority_score: number }) => b.priority_score - a.priority_score)

    const attention = ranked.filter((item: { priority_score: number }) => item.priority_score >= threshold)
    return {
      summary: `${attention.length} of ${(data ?? []).length} asset(s) at or above the ${input.risk_tolerance}-tolerance threshold (${threshold}). Advisory only.`,
      warnings: ["Advisory only: nothing is dispatched or actuated.", ...((data ?? []).length === 500 ? ["Result limited to the first 500 assets."] : [])],
      dataSources: this.dataSources,
      data: {
        system_id: input.system_id,
        advisory_only: true,
        decision_type: "task_prioritization",
        attention_threshold: threshold,
        priority_queue: attention.slice(0, limit),
        scoring: "stored risk score (0-1) + 0.3 if status is fault/maintenance-like + 0.2 if battery < 20%",
      },
    }
  },
}

// ---------------------------------------------------------------------------
// 8. edge_computing_coordinator
// ---------------------------------------------------------------------------

export const edgeComputingCoordinator: SkillDefinition = {
  id: "edge_computing_coordinator",
  name: "Edge computing coordinator",
  description:
    "Health view of your registered edge nodes (fleet devices) with a fallback recommendation: which nodes are online, stale or unregistered, and whether the workload should fall back.",
  category: "Deployment and infrastructure",
  tags: ["edge", "health"],
  status: "live",
  mutates: false,
  dataSources: ["iot_fleet_devices"],
  limitations:
    "Health comes from each node's last_seen time only (online <= 15 min, stale <= 24 h). Latency is not measured. Workloads are not scheduled or moved; the fallback is a recommendation. The control workload is rejected because nothing can actuate.",
  examples: ['{"edge_node_ids":["edge-01","edge-02"],"workload_type":"monitoring","fallback_mode":"cloud"}'],
  inputSchema: {
    type: "object",
    required: ["edge_node_ids", "workload_type"],
    properties: {
      edge_node_ids: { type: "array", description: "Fleet device ids to treat as edge nodes (max 50)", items: { type: "string" } },
      workload_type: str("Edge workload", { enum: ["inference", "data_processing", "monitoring", "control"] }),
      fallback_mode: str("Fallback when edge is unavailable", { enum: ["cloud", "local", "hybrid"], default: "cloud" }),
    },
  },
  async run(input, ctx) {
    if (input.workload_type === "control") {
      throw new SkillError("UNSUPPORTED", "The control workload is not available: edge nodes cannot be commanded from here.")
    }
    const ids: string[] = [...new Set<string>(input.edge_node_ids.map((id: string) => id.trim()).filter(Boolean))]
    if (!ids.length || ids.length > 50) throw new SkillError("INVALID_INPUT", "edge_node_ids needs between 1 and 50 ids")

    const { data, error } = await ctx.supabase
      .from("iot_fleet_devices")
      .select("device_id, device_name, device_type, status, last_seen, firmware_version")
      .eq("user_id", ctx.userId)
      .in("device_id", ids)
    if (error) throw dbError("Failed to read edge nodes", error)

    const byId = new Map<string, any>((data ?? []).map((d: any) => [d.device_id, d]))
    const nodes = ids.map((id) => {
      const node = byId.get(id)
      if (!node) return { node_id: id, health: "unregistered" }
      const age = node.last_seen ? Date.now() - new Date(node.last_seen).getTime() : Infinity
      const health = age <= 15 * 60_000 ? "online" : age <= 24 * HOUR_MS ? "stale" : "offline"
      return {
        node_id: id,
        name: node.device_name,
        device_type: node.device_type,
        registered_status: node.status,
        health,
        last_seen: node.last_seen,
        minutes_since_seen: node.last_seen ? Math.round(age / 60_000) : null,
        firmware_version: node.firmware_version,
      }
    })

    const online = nodes.filter((n) => n.health === "online").length
    const degraded = nodes.length - online
    const recommendation = online === 0 ? `fallback:${input.fallback_mode}` : degraded > 0 ? "run_on_online_nodes" : "run_on_edge"
    const missing = nodes.filter((n) => n.health === "unregistered").length
    return {
      summary: `${online} of ${nodes.length} edge node(s) online. Recommendation: ${recommendation.replace(/_/g, " ")}.`,
      warnings: [
        "Latency is not measured; health is based on last_seen only.",
        ...(missing ? [`${missing} id(s) are not registered to your account.`] : []),
      ],
      dataSources: this.dataSources,
      data: {
        workload_type: input.workload_type,
        fallback_mode: input.fallback_mode,
        recommendation,
        nodes,
        health_rules: "online <= 15 min since last_seen, stale <= 24 h, offline otherwise",
      },
    }
  },
}

// ---------------------------------------------------------------------------
// 9. hybrid_cloud_orchestrator
// ---------------------------------------------------------------------------

export const hybridCloudOrchestrator: SkillDefinition = {
  id: "hybrid_cloud_orchestrator",
  name: "Hybrid cloud readiness",
  description:
    "Checks your recorded cloud connections and edge devices against a deployment strategy (cloud_first, edge_first, balanced) and lists the gaps. Credentials are never read or returned.",
  category: "Deployment and infrastructure",
  tags: ["hybrid-cloud", "readiness"],
  status: "live",
  mutates: false,
  dataSources: ["cloud_service_connections", "iot_fleet_devices"],
  limitations:
    "A readiness report, not an orchestrator: it does not allocate or deploy workloads. workload_requirements are echoed, not evaluated, and no cost or savings figures are produced because no cost data is stored.",
  examples: ['{"deployment_strategy":"balanced"}'],
  inputSchema: {
    type: "object",
    required: ["deployment_strategy"],
    properties: {
      deployment_strategy: str("Resource allocation strategy", { enum: ["cloud_first", "edge_first", "balanced"] }),
      workload_requirements: { type: "object", description: "Compute, storage and latency requirements (echoed back, not evaluated)" },
      cost_optimization: { type: "boolean", default: true },
    },
  },
  async run(input, ctx) {
    const [connections, edge] = await Promise.all([
      ctx.supabase
        .from("cloud_service_connections")
        .select("id, service_type, service_name, connection_status, last_verified_at")
        .eq("user_id", ctx.userId)
        .limit(200),
      ctx.supabase.from("iot_fleet_devices").select("device_id, last_seen").eq("user_id", ctx.userId).limit(500),
    ])
    if (connections.error) throw dbError("Failed to read cloud connections", connections.error)
    if (edge.error) throw dbError("Failed to read edge devices", edge.error)

    const cloud = connections.data ?? []
    const verified = cloud.filter((c: any) => ["connected", "active", "verified"].includes(String(c.connection_status ?? "").toLowerCase()))
    const onlineEdge = (edge.data ?? []).filter((d: any) => d.last_seen && Date.now() - new Date(d.last_seen).getTime() <= 24 * HOUR_MS)

    const needsCloud = input.deployment_strategy !== "edge_first"
    const needsEdge = input.deployment_strategy !== "cloud_first"
    const gaps: string[] = []
    if (needsCloud && verified.length === 0) gaps.push(cloud.length ? "Cloud connections exist but none are verified as connected." : "No cloud service connections are recorded.")
    if (needsEdge && onlineEdge.length === 0) gaps.push((edge.data ?? []).length ? "Edge devices are registered but none reported in the last 24 hours." : "No edge devices are registered.")

    const warnings = ["Readiness report only: nothing is allocated or deployed."]
    if (input.cost_optimization) warnings.push("No cost data is stored, so no cost optimization or savings figure is produced.")
    if (input.workload_requirements && Object.keys(input.workload_requirements).length) warnings.push("workload_requirements were not evaluated against capacity.")

    return {
      summary: gaps.length
        ? `${input.deployment_strategy} is not ready: ${gaps.length} gap(s).`
        : `${input.deployment_strategy} prerequisites are met: ${verified.length} cloud connection(s), ${onlineEdge.length} recently active edge device(s).`,
      warnings,
      dataSources: this.dataSources,
      data: {
        strategy: input.deployment_strategy,
        ready: gaps.length === 0,
        gaps,
        cloud: {
          connections: cloud.length,
          verified: verified.length,
          by_service_type: cloud.reduce((acc: Record<string, number>, c: any) => ({ ...acc, [c.service_type]: (acc[c.service_type] ?? 0) + 1 }), {}),
          services: cloud.map((c: any) => ({ name: c.service_name, type: c.service_type, status: c.connection_status, last_verified_days_ago: daysSince(c.last_verified_at) })),
        },
        edge: { registered: (edge.data ?? []).length, active_last_24h: onlineEdge.length },
        ...(input.workload_requirements && { workload_requirements_echo: input.workload_requirements }),
      },
    }
  },
}

export const platformSkills: SkillDefinition[] = [
  aiAgentDeployment,
  workflowAutomationBuilder,
  aethernetMessaging,
  voiceAgentInterface,
  accessibilityScanner,
  iotDeviceCoordination,
  autonomousSystemProtocol,
  edgeComputingCoordinator,
  hybridCloudOrchestrator,
]
