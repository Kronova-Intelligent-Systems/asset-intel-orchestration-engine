/**
 * The seven data-backed Kronova skills, implemented against the tables that exist in
 * production: assets, asset_lifecycle_events, asset_workflows, asset_tokens,
 * iot_sensor_data and plaid_accounts.
 *
 * Rules every skill follows:
 *  - Every query filters on ctx.userId, so the service-role client used for API keys
 *    can never read another tenant's rows.
 *  - Nothing is fabricated. Missing data is reported as missing and lowers `confidence`.
 *  - Writes only happen when ctx.confirm is true; otherwise the skill returns a dry run.
 */

import { SkillError, type SkillContext, type SkillDefinition, type SkillOutput } from "./types"
import { AUDIO_INPUT_PROPERTIES, resolveVoiceCommand } from "./transcription"

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const DAY_MS = 24 * 60 * 60 * 1000

/** Explicit column list: never select embedding_vector, which is large and useless here. */
const ASSET_COLUMNS =
  "id, asset_id, name, description, asset_type, category, status, operational_status, purchase_date, purchase_cost, current_value, depreciation_rate, maintenance_schedule, compliance_data, risk_score, battery_level, iot_sensor_id, nfc_tag_id, qr_code, created_at"

type AssetRow = Record<string, any>

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (c) => `\\${c}`)
}

function daysSince(date: string | Date | null | undefined): number | null {
  if (!date) return null
  const time = new Date(date).getTime()
  return Number.isFinite(time) ? Math.floor((Date.now() - time) / DAY_MS) : null
}

function round(value: number, digits = 2): number {
  const factor = 10 ** digits
  return Math.round(value * factor) / factor
}

function dbError(message: string, error: { message?: string } | null): SkillError {
  console.error(`[skills] ${message}:`, error?.message)
  return new SkillError("INTERNAL", message)
}

/** Resolves an asset the caller owns by uuid, asset tag, QR code, NFC tag or exact name. */
async function findAsset(ctx: SkillContext, ref: string): Promise<AssetRow> {
  const reference = ref.trim()
  if (!reference) throw new SkillError("INVALID_INPUT", "Asset reference is empty")

  const lookups: Array<[string, string]> = []
  if (UUID_RE.test(reference)) lookups.push(["id", reference])
  lookups.push(["asset_id", reference], ["qr_code", reference], ["nfc_tag_id", reference])

  for (const [column, value] of lookups) {
    const { data, error } = await ctx.supabase
      .from("assets")
      .select(ASSET_COLUMNS)
      .eq("user_id", ctx.userId)
      .eq(column, value)
      .limit(2)
    if (error) throw dbError("Failed to look up asset", error)
    if (data?.length === 1) return data[0]
    if (data?.length > 1) {
      throw new SkillError("AMBIGUOUS", `More than one asset matches ${column} "${reference}"`)
    }
  }

  const { data, error } = await ctx.supabase
    .from("assets")
    .select(ASSET_COLUMNS)
    .eq("user_id", ctx.userId)
    .ilike("name", escapeLike(reference))
    .limit(5)
  if (error) throw dbError("Failed to look up asset", error)
  if (data?.length === 1) return data[0]
  if (data?.length > 1) {
    throw new SkillError("AMBIGUOUS", `${data.length} assets are named "${reference}"; use the asset id`, {
      candidates: data.map((a: AssetRow) => ({ id: a.id, name: a.name })),
    })
  }
  throw new SkillError("NOT_FOUND", `No asset matches "${reference}"`)
}

function annualRate(raw: unknown): number | null {
  const rate = Number(raw)
  if (!Number.isFinite(rate) || rate <= 0) return null
  return rate > 1 ? rate / 100 : rate
}

// ---------------------------------------------------------------------------
// 1. predictive_maintenance_analysis
// ---------------------------------------------------------------------------

export const predictiveMaintenance: SkillDefinition = {
  id: "predictive_maintenance_analysis",
  name: "Predictive maintenance analysis",
  description:
    "Heuristic maintenance-risk assessment for one asset from IoT telemetry, maintenance history, schedule and stored risk score. Reports data coverage and confidence; optionally opens a maintenance workflow.",
  category: "Asset intelligence",
  tags: ["maintenance", "iot", "risk", "assets"],
  status: "live",
  mutates: true,
  dataSources: ["assets", "iot_sensor_data", "asset_lifecycle_events", "asset_workflows"],
  limitations:
    "Rule-based scoring, not a trained failure model. Temperature is the only telemetry signal stored; vibration and pressure are not collected.",
  examples: ['{"asset_id":"<asset uuid or tag>","downtime_cost_per_hour":2500}'],
  inputSchema: {
    type: "object",
    required: ["asset_id"],
    properties: {
      asset_id: { type: "string", description: "Asset uuid, asset tag, QR code, NFC tag or exact name" },
      downtime_cost_per_hour: {
        type: "number",
        minimum: 0,
        description: "Optional. Enables a cost-of-inaction estimate. Omitted means no cost estimate.",
      },
      preventive_maintenance_cost: {
        type: "number",
        minimum: 0,
        description: "Optional. Cost of a preventive visit, used with downtime_cost_per_hour.",
      },
      create_workflow: {
        type: "boolean",
        default: false,
        description: "Open a maintenance workflow when risk is high. Requires confirm.",
      },
    },
  },
  async run(input, ctx) {
    const asset = await findAsset(ctx, input.asset_id)

    const [readings, events] = await Promise.all([
      ctx.supabase
        .from("iot_sensor_data")
        .select("timestamp, temperature, battery_level")
        .eq("asset_id", asset.id)
        .order("timestamp", { ascending: false })
        .limit(50),
      ctx.supabase
        .from("asset_lifecycle_events")
        .select("event_type, event_status, event_date, cost")
        .eq("asset_id", asset.id)
        .eq("user_id", ctx.userId)
        .in("event_type", ["maintenance", "repair", "inspection"])
        .order("event_date", { ascending: false })
        .limit(50),
    ])
    if (readings.error) throw dbError("Failed to read sensor data", readings.error)
    if (events.error) throw dbError("Failed to read maintenance history", events.error)

    const sensor: AssetRow[] = readings.data ?? []
    const history: AssetRow[] = events.data ?? []
    const latest = sensor[0]
    const warnings: string[] = []

    let risk = asset.risk_score !== null && asset.risk_score !== undefined ? Number(asset.risk_score) : 0.05
    const factors: Array<{ factor: string; severity: string; value: unknown; threshold?: number; weight: number }> = []

    const temperature = latest?.temperature !== null && latest?.temperature !== undefined ? Number(latest.temperature) : null
    if (temperature !== null && temperature > 85) {
      factors.push({ factor: "Elevated temperature", severity: "high", value: temperature, threshold: 85, weight: 0.25 })
    }

    const battery = latest?.battery_level ?? asset.battery_level
    if (battery !== null && battery !== undefined && Number(battery) < 20) {
      factors.push({ factor: "Low battery", severity: "medium", value: Number(battery), threshold: 20, weight: 0.1 })
    }

    const lastService = history.find((e) => e.event_type !== "inspection" && e.event_status !== "scheduled")
    const daysSinceService = daysSince(lastService?.event_date)
    if (daysSinceService !== null && daysSinceService > 180) {
      factors.push({
        factor: "Overdue maintenance",
        severity: "high",
        value: daysSinceService,
        threshold: 180,
        weight: 0.2,
      })
    } else if (daysSinceService === null) {
      const age = daysSince(asset.purchase_date)
      if (age !== null && age > 365) {
        factors.push({
          factor: "No maintenance on record for an asset over a year old",
          severity: "medium",
          value: age,
          weight: 0.1,
        })
      }
      warnings.push("No maintenance events are recorded for this asset.")
    }

    const schedule = asset.maintenance_schedule
    const nextDue = schedule && typeof schedule === "object" && !Array.isArray(schedule) ? schedule.next_maintenance : null
    const overdueBy = nextDue ? daysSince(nextDue) : null
    if (overdueBy !== null && overdueBy > 0) {
      factors.push({ factor: "Scheduled maintenance is past due", severity: "high", value: overdueBy, weight: 0.15 })
    }

    for (const f of factors) risk += f.weight
    risk = Math.min(round(risk, 2), 0.95)

    const level = risk > 0.7 ? "critical" : risk > 0.4 ? "high" : risk > 0.2 ? "medium" : "low"
    if (!sensor.length) warnings.push("No IoT telemetry is linked to this asset, so sensor-based factors were not evaluated.")

    const coverage = [sensor.length > 0, history.length > 0, Boolean(nextDue)].filter(Boolean).length
    const confidence = (["low", "low", "medium", "high"] as const)[coverage]

    const action =
      level === "critical"
        ? "Schedule maintenance immediately"
        : level === "high"
          ? "Schedule maintenance within 7 days"
          : level === "medium"
            ? "Schedule maintenance within 30 days"
            : "Continue routine monitoring"

    let financialImpact: Record<string, unknown> | null = null
    if (input.downtime_cost_per_hour !== undefined) {
      const hours = risk > 0.7 ? 48 : risk > 0.4 ? 24 : 8
      const expectedCost = input.downtime_cost_per_hour * hours * risk
      financialImpact = {
        assumed_downtime_hours: hours,
        expected_cost_of_inaction: round(expectedCost),
        ...(input.preventive_maintenance_cost !== undefined && {
          preventive_maintenance_cost: input.preventive_maintenance_cost,
          net_benefit_of_acting: round(expectedCost - input.preventive_maintenance_cost),
        }),
      }
    }

    let workflow: Record<string, unknown> | null = null
    const wantsWorkflow = Boolean(input.create_workflow) && risk > 0.4
    if (wantsWorkflow && ctx.confirm) {
      const { data, error } = await ctx.supabase
        .from("asset_workflows")
        .insert({
          user_id: ctx.userId,
          name: `Predictive maintenance - ${asset.name}`,
          description: `Maintenance risk ${risk} (${level}). ${action}.`,
          asset_type: asset.asset_type,
          trigger_type: "manual",
          trigger_config: { type: "manual", asset_id: asset.id, source: "predictive_maintenance_analysis" },
          steps: [{ action: "schedule_maintenance", asset_id: asset.id, priority: level }],
          is_active: false,
        })
        .select("id, name")
        .single()
      if (error) throw dbError("Failed to create maintenance workflow", error)
      workflow = data
    }

    return {
      summary: `${asset.name}: ${level} maintenance risk (${risk}), ${confidence} confidence. ${action}.`,
      dryRun: wantsWorkflow && !ctx.confirm,
      warnings,
      dataSources: this.dataSources,
      data: {
        asset: { id: asset.id, name: asset.name, asset_type: asset.asset_type },
        heuristic_risk_score: risk,
        risk_level: level,
        confidence,
        risk_factors: factors,
        recommendation: action,
        data_coverage: { telemetry_readings: sensor.length, maintenance_events: history.length, has_schedule: Boolean(nextDue) },
        latest_telemetry: latest ? { timestamp: latest.timestamp, temperature, battery_level: battery ?? null } : null,
        days_since_last_maintenance: daysSinceService,
        financial_impact: financialImpact,
        workflow: wantsWorkflow ? (workflow ?? { would_create: `Predictive maintenance - ${asset.name}` }) : null,
      },
    }
  },
}

// ---------------------------------------------------------------------------
// 2. asset_utilization_optimizer
// ---------------------------------------------------------------------------

export const assetUtilization: SkillDefinition = {
  id: "asset_utilization_optimizer",
  name: "Asset utilization optimizer",
  description:
    "Status-based utilization review across your assets: operating-state mix, idle capital, assets without recent telemetry and consolidation candidates.",
  category: "Asset intelligence",
  tags: ["utilization", "idle-assets", "optimization"],
  status: "live",
  mutates: false,
  dataSources: ["assets", "iot_sensor_data"],
  limitations:
    "Utilization is derived from operational status and telemetry recency. Hours-of-use and revenue-per-asset are not stored, so no utilization percentage or ROI is estimated.",
  examples: ['{"scope":"category","entity_id":"equipment","time_period_days":30}'],
  inputSchema: {
    type: "object",
    required: [],
    properties: {
      scope: { type: "string", enum: ["organization", "category", "single_asset"], default: "organization" },
      entity_id: { type: "string", description: "Asset type (for category) or asset reference (for single_asset)" },
      time_period_days: { type: "integer", minimum: 1, maximum: 365, default: 30, description: "Telemetry window" },
    },
  },
  async run(input, ctx) {
    let assets: AssetRow[]
    if (input.scope === "single_asset") {
      if (!input.entity_id) throw new SkillError("INVALID_INPUT", "entity_id is required for single_asset scope")
      assets = [await findAsset(ctx, input.entity_id)]
    } else {
      let query = ctx.supabase.from("assets").select(ASSET_COLUMNS).eq("user_id", ctx.userId).limit(500)
      if (input.scope === "category") {
        if (!input.entity_id) throw new SkillError("INVALID_INPUT", "entity_id is required for category scope")
        query = query.eq("asset_type", input.entity_id)
      }
      const { data, error } = await query
      if (error) throw dbError("Failed to read assets", error)
      assets = data ?? []
    }

    const warnings: string[] = []
    if (assets.length === 500) warnings.push("Result limited to the first 500 assets.")
    if (!assets.length) {
      return {
        summary: "No assets in scope.",
        dataSources: this.dataSources,
        warnings,
        data: { scope: input.scope, assets_analyzed: 0 },
      }
    }

    const since = new Date(Date.now() - input.time_period_days * DAY_MS).toISOString()
    const { data: telemetry, error } = await ctx.supabase
      .from("iot_sensor_data")
      .select("asset_id")
      .in(
        "asset_id",
        assets.map((a) => a.id),
      )
      .gte("timestamp", since)
      .limit(10000)
    if (error) throw dbError("Failed to read telemetry", error)
    const withTelemetry = new Set((telemetry ?? []).map((r: AssetRow) => r.asset_id))

    const stateOf = (a: AssetRow): string => a.operational_status ?? (a.status === "active" ? "active" : a.status)
    const byState: Record<string, number> = {}
    const byType: Record<string, { total: number; idle: number }> = {}
    const idle: AssetRow[] = []

    for (const asset of assets) {
      const state = stateOf(asset)
      byState[state] = (byState[state] ?? 0) + 1
      const bucket = (byType[asset.asset_type] ??= { total: 0, idle: 0 })
      bucket.total += 1
      if (state === "idle" || state === "inactive") {
        bucket.idle += 1
        idle.push(asset)
      }
    }

    const idleValue = idle.reduce((sum, a) => sum + (Number(a.current_value) || 0), 0)
    const totalValue = assets.reduce((sum, a) => sum + (Number(a.current_value) || 0), 0)

    const recommendations: Array<Record<string, unknown>> = []
    for (const [type, counts] of Object.entries(byType)) {
      if (counts.idle >= 2) {
        recommendations.push({
          type: "consolidation_review",
          asset_type: type,
          idle_assets: counts.idle,
          action: `${counts.idle} of ${counts.total} ${type} assets are idle. Review whether they can be redeployed or retired before buying more.`,
        })
      }
    }
    for (const asset of idle.sort((a, b) => (Number(b.current_value) || 0) - (Number(a.current_value) || 0)).slice(0, 5)) {
      recommendations.push({
        type: "idle_asset_review",
        asset_id: asset.id,
        asset_name: asset.name,
        current_value: Number(asset.current_value) || 0,
        action: "Idle asset holding capital. Redeploy, lease or retire.",
      })
    }

    const noTelemetry = assets.filter((a) => !withTelemetry.has(a.id))
    if (noTelemetry.length === assets.length) {
      warnings.push(`None of these assets reported telemetry in the last ${input.time_period_days} days.`)
    }

    const active = byState["active"] ?? 0
    return {
      summary: `${assets.length} assets reviewed: ${active} active, ${idle.length} idle holding ${round(idleValue)} in current value.`,
      dataSources: this.dataSources,
      warnings,
      data: {
        scope: input.scope,
        window_days: input.time_period_days,
        assets_analyzed: assets.length,
        utilization_basis: "operational status and telemetry recency",
        state_breakdown: byState,
        active_share_pct: round((active / assets.length) * 100, 1),
        idle_assets: idle.length,
        idle_value: round(idleValue),
        total_value: round(totalValue),
        assets_without_recent_telemetry: noTelemetry.length,
        recommendations,
      },
    }
  },
}

// ---------------------------------------------------------------------------
// 3. voice_data_entry_processor
// ---------------------------------------------------------------------------

const EVENT_PATTERNS: Array<[RegExp, string]> = [
  [/\b(repair|repaired|fix|fixed)\b/i, "repair"],
  [/\b(inspect|inspection|inspected|check|checked)\b/i, "inspection"],
  [/\b(maintenance|oil change|service|serviced|calibrat\w*)\b/i, "maintenance"],
  [/\b(moved|relocated|transferred)\b/i, "moved"],
  [/\b(deployed)\b/i, "deployed"],
]

export const voiceDataEntry: SkillDefinition = {
  id: "voice_data_entry_processor",
  name: "Voice data entry",
  description:
    "Turns a spoken or typed command into a structured lifecycle event (maintenance, repair, inspection, move) for one of your assets. Send voice_command as text or audio_base64 as audio, which is transcribed with ElevenLabs. Previews the parsed event, including the transcript, unless confirm is set.",
  category: "Asset intelligence",
  tags: ["voice", "data-entry", "maintenance-log", "speech-to-text"],
  status: "live",
  mutates: true,
  dataSources: ["assets", "asset_lifecycle_events", "elevenlabs"],
  limitations:
    "Pattern-based parsing of the command text. Audio is limited to about 3 MB and is transcribed by ElevenLabs, so transcription errors can change the parse; check the returned transcript before confirming. Ambiguous commands are returned for clarification instead of being guessed.",
  examples: [
    '{"voice_command":"Log completed oil change on forklift FL-12, cost $85, good condition"}',
    '{"audio_base64":"<base64 audio of the same sentence>","language":"en"}',
  ],
  inputSchema: {
    type: "object",
    required: [],
    properties: {
      voice_command: { type: "string", description: "Transcribed command. Send this or audio_base64.", maxLength: 500 },
      ...AUDIO_INPUT_PROPERTIES,
      asset_ref: { type: "string", description: "Optional explicit asset uuid, tag, QR, NFC tag or name. Overrides parsing." },
      context: { type: "string", maxLength: 100 },
    },
  },
  async run(input, ctx) {
    const resolved = await resolveVoiceCommand(input)
    const command = resolved.command
    const transcriptionData = resolved.transcription ? { transcript: command, transcription: resolved.transcription } : {}
    const eventType = EVENT_PATTERNS.find(([pattern]) => pattern.test(command))?.[1] ?? null

    const parsedRef = command.match(/\b(?:asset|forklift|truck|equipment|vehicle)[\s#:-]*([a-z0-9][a-z0-9-]{1,40})\b/i)?.[1]
    const assetRef: string | undefined = input.asset_ref ?? parsedRef

    const costMatch = command.match(/\$\s*(\d+(?:\.\d+)?)/) ?? command.match(/\bcost(?:s|ing)?\s*(?:of|was|is)?\s*(\d+(?:\.\d+)?)/i)
    const cost = costMatch ? Number.parseFloat(costMatch[1]) : null

    const condition = /\b(poor condition|needs repair|damaged|broken)\b/i.test(command)
      ? "poor"
      : /\b(fair condition|some wear|worn)\b/i.test(command)
        ? "fair"
        : /\b(good condition|looks good|excellent)\b/i.test(command)
          ? "good"
          : null
    const severity = condition === "poor" ? "high" : condition === "fair" ? "normal" : condition === "good" ? "low" : "normal"
    const eventStatus = /\b(schedule|scheduled|plan|planned|book)\b/i.test(command) ? "scheduled" : "completed"

    const parsed = { event_type: eventType, asset_reference: assetRef ?? null, cost, condition, event_status: eventStatus }

    if (!eventType || !assetRef) {
      return {
        summary: "Could not fully understand the command; nothing was recorded.",
        dataSources: this.dataSources,
        warnings: [
          !eventType ? "No action found. Say maintenance, repair, inspection, moved or deployed." : "",
          !assetRef ? "No asset found. Name the asset or pass asset_ref." : "",
          ...resolved.warnings,
        ].filter(Boolean),
        data: { ...transcriptionData, parsed, recorded: false, needs_clarification: true },
      }
    }

    const asset = await findAsset(ctx, assetRef)
    const event = {
      asset_id: asset.id,
      user_id: ctx.userId,
      event_type: eventType,
      event_status: eventStatus,
      event_date: new Date().toISOString(),
      cost,
      severity,
      description: command.slice(0, 500),
      performed_by: "voice",
      is_automated: false,
      metadata: {
        source: "voice_data_entry_processor",
        input_mode: resolved.transcription ? "audio" : "text",
        context: input.context ?? null,
        condition,
      },
    }

    if (!ctx.confirm) {
      return {
        summary: `Parsed ${eventType} for ${asset.name}. Set confirm to record it.`,
        dryRun: true,
        warnings: resolved.warnings.length ? resolved.warnings : undefined,
        dataSources: this.dataSources,
        data: { ...transcriptionData, parsed, recorded: false, asset: { id: asset.id, name: asset.name }, would_write: event },
      }
    }

    const { data, error } = await ctx.supabase.from("asset_lifecycle_events").insert(event).select("id, event_type, event_date").single()
    if (error) throw dbError("Failed to record lifecycle event", error)

    return {
      summary: `Recorded ${eventType} for ${asset.name}.`,
      warnings: resolved.warnings.length ? resolved.warnings : undefined,
      dataSources: this.dataSources,
      data: { ...transcriptionData, parsed, recorded: true, asset: { id: asset.id, name: asset.name }, event: data },
    }
  },
}

// ---------------------------------------------------------------------------
// 4. compliance_monitoring_system
// ---------------------------------------------------------------------------

type Severity = "critical" | "high" | "medium"
interface ComplianceIssue {
  asset_id: string
  asset_name: string
  rule: string
  severity: Severity
  detail: string
}

const SEVERITY_ORDER: Record<Severity, number> = { critical: 0, high: 1, medium: 2 }

export const complianceMonitoring: SkillDefinition = {
  id: "compliance_monitoring_system",
  name: "Compliance monitoring",
  description:
    "Checks stored compliance data and inspection history for expired certifications, overdue inspections and assets flagged non-compliant. Assets with no compliance data are reported as unknown, never as compliant.",
  category: "Asset intelligence",
  tags: ["compliance", "osha", "inspections", "certifications"],
  status: "live",
  mutates: true,
  dataSources: ["assets", "asset_lifecycle_events", "asset_workflows"],
  limitations:
    "Evaluates the compliance data you have recorded on assets. It does not look up regulations, estimate fines, or certify compliance.",
  examples: ['{"regulation_types":["OSHA","ISO"],"create_remediation_workflows":false}'],
  inputSchema: {
    type: "object",
    required: [],
    properties: {
      asset_id: { type: "string", description: "Optional single asset. Omit to scan everything you own." },
      regulation_types: {
        type: "array",
        items: { type: "string", enum: ["OSHA", "FDA", "EPA", "ISO", "ANSI", "SOC2", "All"] },
        default: ["All"],
      },
      create_remediation_workflows: {
        type: "boolean",
        default: false,
        description: "Open inactive remediation workflows for the top issues. Requires confirm.",
      },
    },
  },
  async run(input, ctx) {
    let assets: AssetRow[]
    if (input.asset_id) assets = [await findAsset(ctx, input.asset_id)]
    else {
      const { data, error } = await ctx.supabase.from("assets").select(ASSET_COLUMNS).eq("user_id", ctx.userId).limit(500)
      if (error) throw dbError("Failed to read assets", error)
      assets = data ?? []
    }

    const warnings: string[] = []
    if (assets.length === 500) warnings.push("Result limited to the first 500 assets.")

    const inspectionDates = new Map<string, string>()
    if (assets.length) {
      const { data, error } = await ctx.supabase
        .from("asset_lifecycle_events")
        .select("asset_id, event_date")
        .eq("user_id", ctx.userId)
        .in("event_type", ["inspection", "compliance_check"])
        .in(
          "asset_id",
          assets.map((a) => a.id),
        )
        .order("event_date", { ascending: false })
        .limit(5000)
      if (error) throw dbError("Failed to read inspection history", error)
      for (const row of data ?? []) if (!inspectionDates.has(row.asset_id)) inspectionDates.set(row.asset_id, row.event_date)
    }

    const types: string[] = input.regulation_types
    const all = types.includes("All")
    const relevant = (text: string) => all || types.some((t) => text.toLowerCase().includes(t.toLowerCase()))

    const issues: ComplianceIssue[] = []
    let compliant = 0
    let noData = 0

    for (const asset of assets) {
      const data = asset.compliance_data && typeof asset.compliance_data === "object" ? asset.compliance_data : {}
      const lastInspection = data.last_inspection ?? data.lastInspection ?? data.lastAudit ?? inspectionDates.get(asset.id) ?? null
      const certifications: unknown[] = Array.isArray(data.certifications) ? data.certifications : []
      const hasData = Object.keys(data).length > 0 || lastInspection !== null

      if (!hasData) {
        noData += 1
        continue
      }

      const found: ComplianceIssue[] = []
      const push = (rule: string, severity: Severity, detail: string) =>
        found.push({ asset_id: asset.id, asset_name: asset.name, rule, severity, detail })

      if (data.osha_compliant === false && relevant("OSHA")) {
        push("OSHA", "critical", "Asset is flagged as not OSHA compliant.")
      }

      for (const cert of certifications) {
        if (!cert || typeof cert !== "object") continue
        const c = cert as Record<string, any>
        const name = String(c.name ?? c.type ?? c.regulation ?? "certification")
        if (!relevant(name)) continue
        const expiry = c.expires_at ?? c.expiry ?? c.expires ?? null
        const remaining = expiry ? -(daysSince(expiry) ?? 0) : null
        if (remaining !== null && remaining < 0) push(name, "high", `Certification expired ${-remaining} days ago.`)
        else if (remaining !== null && remaining < 30) push(name, "medium", `Certification expires in ${remaining} days.`)
      }

      const age = daysSince(lastInspection)
      if (age !== null && age > 365) push("Inspection", "high", `Last inspection was ${age} days ago.`)
      else if (age === null) push("Inspection", "medium", "No inspection date is recorded.")

      if (found.length) issues.push(...found)
      else compliant += 1
    }

    issues.sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity])
    const assessed = assets.length - noData
    if (noData) warnings.push(`${noData} asset(s) have no compliance data and are reported as unknown, not compliant.`)

    let workflows: Array<Record<string, unknown>> = []
    const wantsWorkflows = Boolean(input.create_remediation_workflows) && issues.length > 0
    if (wantsWorkflows && ctx.confirm) {
      const top = issues.slice(0, 10)
      const names = top.map((i) => `Compliance remediation - ${i.asset_name} - ${i.rule}`)
      const { data: existing } = await ctx.supabase.from("asset_workflows").select("name").eq("user_id", ctx.userId).in("name", names)
      const taken = new Set((existing ?? []).map((w: AssetRow) => w.name))
      const rows = top
        .map((issue, index) => ({ issue, name: names[index] }))
        .filter(({ name }) => !taken.has(name))
        .map(({ issue, name }) => ({
          user_id: ctx.userId,
          name,
          description: issue.detail,
          trigger_type: "manual",
          trigger_config: { type: "manual", asset_id: issue.asset_id, source: "compliance_monitoring_system" },
          steps: [{ action: "remediate_compliance", rule: issue.rule, severity: issue.severity }],
          is_active: false,
        }))
      if (rows.length) {
        const { data, error } = await ctx.supabase.from("asset_workflows").insert(rows).select("id, name")
        if (error) throw dbError("Failed to create remediation workflows", error)
        workflows = data ?? []
      }
    }

    return {
      summary: `${assets.length} assets scanned: ${issues.length} issue(s), ${compliant} compliant, ${noData} with no data.`,
      dryRun: wantsWorkflows && !ctx.confirm,
      warnings,
      dataSources: this.dataSources,
      data: {
        assets_scanned: assets.length,
        assets_with_compliance_data: assessed,
        compliant_assets: compliant,
        assets_without_data: noData,
        compliance_rate_pct: assessed ? round((compliant / assessed) * 100, 1) : null,
        issue_counts: {
          critical: issues.filter((i) => i.severity === "critical").length,
          high: issues.filter((i) => i.severity === "high").length,
          medium: issues.filter((i) => i.severity === "medium").length,
        },
        issues: issues.slice(0, 100),
        workflows_created: workflows,
      },
    }
  },
}

// ---------------------------------------------------------------------------
// 5. asset_tokenization_engine (preview: proposal only, no minting)
// ---------------------------------------------------------------------------

export const assetTokenization: SkillDefinition = {
  id: "asset_tokenization_engine",
  name: "Asset tokenization proposal",
  description:
    "Builds a tokenization proposal for one asset (share count, price per share, valuation basis) and reports existing token records. Does not mint tokens or write records.",
  category: "Blockchain and tokenization",
  tags: ["tokenization", "sui", "fractional-ownership", "proposal"],
  status: "preview",
  mutates: false,
  dataSources: ["assets", "asset_tokens"],
  limitations:
    "Proposal only. No Move contract is deployed and no on-chain transaction is sent, so no contract address or transaction hash is ever returned. Fractional ownership can be a regulated security; legal review is required before issuing.",
  examples: ['{"asset_id":"<asset uuid>","total_shares":1000}'],
  inputSchema: {
    type: "object",
    required: ["asset_id"],
    properties: {
      asset_id: { type: "string" },
      tokenization_type: { type: "string", enum: ["full_ownership", "fractional", "revenue_share", "utility"], default: "fractional" },
      total_shares: { type: "integer", minimum: 1, maximum: 1000000, default: 100 },
      price_per_share_usd: { type: "number", minimum: 0 },
      enable_secondary_market: { type: "boolean", default: true },
      compliance_jurisdiction: { type: "string", enum: ["US", "EU", "Asia", "Global"], default: "US" },
    },
  },
  async run(input, ctx) {
    const asset = await findAsset(ctx, input.asset_id)
    const { data: tokens, error } = await ctx.supabase
      .from("asset_tokens")
      .select("id, token_type, token_symbol, blockchain, status, total_supply, contract_address, tx_hash")
      .eq("asset_id", asset.id)
      .eq("user_id", ctx.userId)
      .limit(20)
    if (error) throw dbError("Failed to read token records", error)

    const warnings: string[] = []
    const valuation = Number(asset.current_value) || Number(asset.purchase_cost) || 0
    if (!valuation && input.price_per_share_usd === undefined) {
      warnings.push("The asset has no current_value or purchase_cost, so no price per share could be derived.")
    }
    const shares = input.tokenization_type === "full_ownership" ? 1 : input.total_shares
    const price = input.price_per_share_usd ?? (valuation ? round(valuation / shares, 4) : null)
    if ((tokens ?? []).length) warnings.push("This asset already has token records; issuing more may dilute existing holders.")

    return {
      summary: `Proposal for ${asset.name}: ${shares} share(s)${price !== null ? ` at ${price} each` : ""}. Not minted.`,
      dryRun: true,
      warnings,
      dataSources: this.dataSources,
      data: {
        asset: { id: asset.id, name: asset.name, asset_type: asset.asset_type },
        proposal: {
          tokenization_type: input.tokenization_type,
          total_shares: shares,
          price_per_share_usd: price,
          implied_total_value_usd: price !== null ? round(price * shares) : null,
          valuation_basis: Number(asset.current_value) ? "current_value" : Number(asset.purchase_cost) ? "purchase_cost" : "none",
          secondary_market_requested: input.enable_secondary_market,
          jurisdiction: input.compliance_jurisdiction,
        },
        existing_tokens: tokens ?? [],
        executable: false,
        blockers: [
          "On-chain minting is not connected to this endpoint.",
          "Securities and jurisdiction review has not been performed.",
        ],
      },
    }
  },
}

// ---------------------------------------------------------------------------
// 6. provenance_verification_system (preview: record completeness, no chain lookup)
// ---------------------------------------------------------------------------

export const provenanceVerification: SkillDefinition = {
  id: "provenance_verification_system",
  name: "Provenance record review",
  description:
    "Assembles an asset's recorded history and checks it for gaps and inconsistencies: missing creation record, future-dated events, undocumented maintenance and on-chain references. Reports record completeness; it does not verify anything on-chain.",
  category: "Blockchain and tokenization",
  tags: ["provenance", "audit-trail", "lifecycle"],
  status: "preview",
  mutates: false,
  dataSources: ["assets", "asset_lifecycle_events", "asset_tokens"],
  limitations:
    "Checks the completeness and consistency of records stored in Kronova. On-chain references are listed but not looked up, so nothing is reported as cryptographically verified.",
  examples: ['{"asset_id":"<asset uuid>"}'],
  inputSchema: {
    type: "object",
    required: ["asset_id"],
    properties: {
      asset_id: { type: "string" },
      include_maintenance_records: { type: "boolean", default: true },
      include_onchain_references: { type: "boolean", default: true },
    },
  },
  async run(input, ctx) {
    const asset = await findAsset(ctx, input.asset_id)

    const [events, tokens] = await Promise.all([
      ctx.supabase
        .from("asset_lifecycle_events")
        .select("id, event_type, event_status, event_date, description, performed_by, documentation")
        .eq("asset_id", asset.id)
        .eq("user_id", ctx.userId)
        .order("event_date", { ascending: true })
        .limit(200),
      input.include_onchain_references
        ? ctx.supabase
            .from("asset_tokens")
            .select("id, token_type, blockchain, contract_address, tx_hash, status")
            .eq("asset_id", asset.id)
            .eq("user_id", ctx.userId)
            .limit(50)
        : Promise.resolve({ data: [], error: null }),
    ])
    if (events.error) throw dbError("Failed to read lifecycle events", events.error)
    if (tokens.error) throw dbError("Failed to read token records", tokens.error)

    const timeline: AssetRow[] = events.data ?? []
    const refs: AssetRow[] = tokens.data ?? []
    const anomalies: Array<{ type: string; severity: string; detail: string }> = []
    let score = 100

    const flag = (type: string, severity: string, detail: string, penalty: number) => {
      anomalies.push({ type, severity, detail })
      score -= penalty
    }

    if (!timeline.some((e) => e.event_type === "created")) flag("missing_creation_record", "medium", "No 'created' event is recorded.", 15)
    if (!asset.purchase_date) flag("missing_purchase_date", "low", "Purchase date is not recorded.", 10)
    if (!asset.purchase_cost) flag("missing_purchase_cost", "low", "Purchase cost is not recorded.", 5)

    const future = timeline.filter((e) => new Date(e.event_date).getTime() > Date.now() && e.event_status === "completed")
    if (future.length) flag("future_dated_events", "high", `${future.length} completed event(s) are dated in the future.`, 25)

    if (asset.purchase_date) {
      const early = timeline.filter((e) => e.event_type !== "created" && new Date(e.event_date) < new Date(asset.purchase_date))
      if (early.length) flag("events_before_purchase", "medium", `${early.length} event(s) predate the purchase date.`, 15)
    }

    if (input.include_maintenance_records) {
      const needsDocs = timeline.filter(
        (e) => ["maintenance", "repair", "inspection"].includes(e.event_type) && e.event_status === "completed",
      )
      const undocumented = needsDocs.filter((e) => !e.documentation || Object.keys(e.documentation).length === 0)
      if (undocumented.length) {
        flag("undocumented_service_events", "low", `${undocumented.length} of ${needsDocs.length} completed service event(s) have no documentation.`, 10)
      }
    }

    const incompleteRefs = refs.filter((r) => !r.contract_address || !r.tx_hash)
    if (incompleteRefs.length) flag("incomplete_onchain_reference", "medium", `${incompleteRefs.length} token record(s) lack a contract address or transaction hash.`, 10)

    score = Math.max(score, 0)
    const status = timeline.length === 0 ? "insufficient_records" : anomalies.length ? "gaps_found" : "complete"

    return {
      summary: `${asset.name}: ${status.replace("_", " ")}, record completeness ${score}%. On-chain verification was not performed.`,
      warnings: refs.length ? ["On-chain references are listed but were not looked up on the network."] : [],
      dataSources: this.dataSources,
      data: {
        asset: { id: asset.id, name: asset.name },
        status,
        record_completeness_pct: score,
        onchain_verification: "not_performed",
        anomalies,
        timeline: timeline.map((e) => ({ type: e.event_type, status: e.event_status, date: e.event_date, performed_by: e.performed_by })),
        onchain_references: refs.map((r) => ({ blockchain: r.blockchain, contract_address: r.contract_address, tx_hash: r.tx_hash, status: r.status })),
      },
    }
  },
}

// ---------------------------------------------------------------------------
// 7. financial_data_integration_engine
// ---------------------------------------------------------------------------

export const financialIntegration: SkillDefinition = {
  id: "financial_data_integration_engine",
  name: "Asset financial analysis",
  description:
    "Total cost of ownership and cost breakdown for one asset from its purchase cost, costed lifecycle events and depreciation rate, with linked Plaid accounts as context and a depreciation-only projection.",
  category: "Financial integration",
  tags: ["tco", "depreciation", "cost-breakdown", "plaid"],
  status: "live",
  mutates: false,
  dataSources: ["assets", "asset_lifecycle_events", "plaid_accounts"],
  limitations:
    "Revenue, ROI and cash-flow analyses are not supported because revenue per asset is not stored. Projections assume flat recurring costs and declining-balance depreciation, with no growth assumptions.",
  examples: ['{"asset_id":"<asset uuid>","analysis_type":"tco","time_period_months":12}'],
  inputSchema: {
    type: "object",
    required: ["asset_id"],
    properties: {
      asset_id: { type: "string" },
      analysis_type: { type: "string", enum: ["tco", "cost_breakdown"], default: "tco" },
      time_period_months: { type: "integer", minimum: 1, maximum: 120, default: 12 },
      include_projections: { type: "boolean", default: true },
      projection_years: { type: "integer", minimum: 1, maximum: 10, default: 3 },
    },
  },
  async run(input, ctx) {
    const asset = await findAsset(ctx, input.asset_id)
    const cutoff = new Date()
    cutoff.setMonth(cutoff.getMonth() - input.time_period_months)

    const [events, accounts] = await Promise.all([
      ctx.supabase
        .from("asset_lifecycle_events")
        .select("event_type, event_date, cost")
        .eq("asset_id", asset.id)
        .eq("user_id", ctx.userId)
        .not("cost", "is", null)
        .gte("event_date", cutoff.toISOString())
        .limit(1000),
      ctx.supabase
        .from("plaid_accounts")
        .select("name, institution_name, account_type, current_balance, currency_code, last_synced_at")
        .eq("user_id", ctx.userId)
        .eq("linked_asset_id", asset.id)
        .limit(20),
    ])
    if (events.error) throw dbError("Failed to read costed events", events.error)
    if (accounts.error) throw dbError("Failed to read linked accounts", accounts.error)

    const costed: AssetRow[] = events.data ?? []
    const byType: Record<string, number> = {}
    for (const e of costed) byType[e.event_type] = round((byType[e.event_type] ?? 0) + Math.abs(Number(e.cost) || 0))
    const recurring = round(Object.values(byType).reduce((s, v) => s + v, 0))
    const monthly = round(recurring / input.time_period_months)
    const annualized = round(monthly * 12)

    const acquisition = Number(asset.purchase_cost) || 0
    const bookValue = Number(asset.current_value) || acquisition
    const rate = annualRate(asset.depreciation_rate)
    const ageYears = asset.purchase_date ? round((daysSince(asset.purchase_date) ?? 0) / 365, 1) : null

    const warnings: string[] = []
    if (!costed.length) warnings.push("No costed lifecycle events in this period; recurring cost is zero because none is recorded.")
    if (!acquisition) warnings.push("Purchase cost is not recorded; acquisition cost is treated as zero.")
    if (rate === null) warnings.push("No depreciation rate is recorded; projected value is held flat.")

    let projections: Array<Record<string, number>> | null = null
    if (input.include_projections) {
      projections = []
      for (let year = 1; year <= input.projection_years; year++) {
        projections.push({
          year,
          projected_book_value: round(bookValue * (1 - (rate ?? 0)) ** year),
          projected_recurring_cost: annualized,
          cumulative_recurring_cost: round(annualized * year),
        })
      }
    }

    return {
      summary: `${asset.name}: ${recurring} recurring cost over ${input.time_period_months} months on ${acquisition} acquisition cost.`,
      warnings,
      dataSources: this.dataSources,
      data: {
        asset: { id: asset.id, name: asset.name, asset_type: asset.asset_type },
        analysis_type: input.analysis_type,
        period_months: input.time_period_months,
        cost_breakdown: {
          acquisition_cost: acquisition,
          recurring_costs_by_event_type: byType,
          total_recurring_cost: recurring,
          monthly_average: monthly,
          annualized: annualized,
          total_cost_of_ownership_to_date: round(acquisition + recurring),
        },
        valuation: {
          current_book_value: bookValue,
          annual_depreciation_rate: rate,
          asset_age_years: ageYears,
        },
        projections,
        linked_accounts: accounts.data ?? [],
        costed_events_considered: costed.length,
      },
    }
  },
}

export { ASSET_COLUMNS, daysSince, dbError, findAsset, round }
export type { AssetRow }

export const dataSkills: SkillDefinition[] = [
  predictiveMaintenance,
  assetUtilization,
  voiceDataEntry,
  complianceMonitoring,
  assetTokenization,
  provenanceVerification,
  financialIntegration,
]
