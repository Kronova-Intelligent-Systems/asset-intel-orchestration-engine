import { generateText } from "ai"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { createAdminSupabaseClient } from "@/lib/supabase/admin"
import { AgentSystem } from "@/lib/ai/agent-system"
import { formatAssetContext } from "@/lib/utils/asset-context-formatter"
import type { Intent } from "@/lib/voice/nlp-intent-classifier"

const PENDING_ACTION_TTL_MS = 5 * 60 * 1000
const DEFAULT_AGENT_MODEL = "gpt-4.1-mini"
const VOICE_AGENT_TOOLS = [
  "web_search",
  "query_database",
  "optimize_packaging",
  "estimate_shipping_cost",
  "analyze_data",
  "generate_code",
  "search_embeddings",
  "query_sui_blockchain",
  "analyze_nfts",
] as const

interface AgentDraft {
  name: string
  description: string
  system_prompt: string
  tools: string[]
  category: string
  temperature: number
  max_tokens: number
}

type PendingAction =
  | { kind: "create_agent"; draft: AgentDraft; modelId: string; modelLabel: string }
  | { kind: "tokenize_asset"; assetId: string; assetName: string; walletAddress?: string }

export interface CommandContext {
  userId: string
  sessionId: string
  conversationHistory: Array<{
    role: "user" | "assistant"
    content: string
  }>
  assetIds?: string[]
  currentAgent?: string
  currentWorkflow?: string
}

export interface CommandResult {
  success: boolean
  response: string
  data?: any
  followUpActions?: string[]
  error?: string
}

interface AssetRow {
  name: string
  asset_type: string
  status: string
  current_value: number | null
}

export class CommandRouter {
  private supabase: any
  private agentSystem: AgentSystem

  constructor() {
    this.agentSystem = new AgentSystem()
  }

  async initialize() {
    this.supabase = await createServerSupabaseClient()
  }

  async routeCommand(intent: Intent, context: CommandContext): Promise<CommandResult> {
    if (!this.supabase) {
      await this.initialize()
    }

    console.log(`[CommandRouter] Routing action: ${intent.action}`)

    // Low confidence check
    if (intent.confidence < 0.4) {
      return {
        success: false,
        response: intent.suggestedResponse || "I'm not sure I understood that. Could you rephrase your request?",
        followUpActions: ["help", "repeat"],
      }
    }

    try {
      switch (intent.action) {
        case "execute_agent":
          return await this.handleExecuteAgent(intent, context)

        case "query_assets":
          return await this.handleQueryAssets(intent, context)

        case "create_agent":
          return await this.handleCreateAgent(intent, context)

        case "update_agent":
          return await this.handleUpdateAgent(intent, context)

        case "delete_agent":
          return await this.handleDeleteAgent(intent, context)

        case "tokenize_asset":
          return await this.handleTokenizeAsset(intent, context)

        case "create_workflow":
          return await this.handleCreateWorkflow(intent, context)

        case "execute_workflow":
          return await this.handleExecuteWorkflow(intent, context)

        case "get_dashboard_metrics":
          return await this.handleGetDashboardMetrics(intent, context)

        case "generate_report":
          return await this.handleGenerateReport(intent, context)

        case "update_asset":
          return await this.handleUpdateAsset(intent, context)

        case "add_asset":
          return await this.handleAddAsset(intent, context)

        case "get_asset_insights":
          return await this.handleGetAssetInsights(intent, context)

        case "manage_integrations":
          return await this.handleManageIntegrations(intent, context)

        case "voice_settings":
          return await this.handleVoiceSettings(intent, context)

        case "help":
          return await this.handleHelp(intent, context)

        case "confirm_action":
          return await this.handleConfirmAction(context)

        case "cancel_action":
          return await this.handleCancelAction(context)

        default:
          return {
            success: false,
            response: `I understand you want to ${intent.action}, but I'm not sure how to help with that yet. Try asking in a different way.`,
            followUpActions: ["help"],
          }
      }
    } catch (error) {
      console.error(`[CommandRouter] Error routing ${intent.action}:`, error)
      return {
        success: false,
        response: "I encountered an error processing your command. Please try again.",
        error: error instanceof Error ? error.message : "Unknown error",
      }
    }
  }

  private async handleExecuteAgent(intent: Intent, context: CommandContext): Promise<CommandResult> {
    const agentName = intent.entities.agent_name || intent.entities.agent || context.currentAgent
    const prompt = intent.entities.prompt || intent.entities.query || intent.entities.question

    if (!agentName) {
      return {
        success: false,
        response: "Which agent would you like me to run?",
        followUpActions: ["list_agents"],
      }
    }

    if (!prompt) {
      return {
        success: false,
        response: `What would you like the ${agentName} agent to do?`,
      }
    }

    // Find agent
    const { data: agent } = await this.supabase
      .from("ai_agents")
      .select("*")
      .eq("user_id", context.userId)
      .ilike("name", `%${agentName}%`)
      .eq("is_active", true)
      .maybeSingle()

    if (!agent) {
      return {
        success: false,
        response: `I couldn't find an active agent named "${agentName}". Would you like to see your available agents?`,
        followUpActions: ["list_agents", "create_agent"],
      }
    }

    // Build prompt with context
    let fullPrompt = prompt
    if (context.assetIds && context.assetIds.length > 0) {
      const assetContext = await formatAssetContext(context.assetIds, context.userId)
      fullPrompt = `${assetContext}\n\n${prompt}`
    }

    // Execute agent
    const result = await this.agentSystem.executeAgent(agent.id, fullPrompt)

    return {
      success: true,
      response: `${agent.name} says: ${result.finalResponse}`,
      data: result,
      followUpActions: ["execute_again", "modify_prompt"],
    }
  }

  private async handleQueryAssets(intent: Intent, context: CommandContext): Promise<CommandResult> {
    const searchTerm = intent.entities.asset_name || intent.entities.search || intent.entities.query
    const status = intent.entities.status
    const assetType = intent.entities.asset_type

    let query = this.supabase
      .from("assets")
      .select("id, name, asset_type, status, current_value, purchase_cost")
      .eq("user_id", context.userId)

    if (searchTerm) {
      query = query.or(`name.ilike.%${searchTerm}%,asset_type.ilike.%${searchTerm}%,description.ilike.%${searchTerm}%`)
    }

    if (status) {
      query = query.eq("status", status)
    }

    if (assetType) {
      query = query.ilike("asset_type", `%${assetType}%`)
    }

    const { data: assets, error } = await query.limit(10)

    if (error) {
      return {
        success: false,
        response: "I encountered an error searching for assets.",
        error: error.message,
      }
    }

    if (!assets || assets.length === 0) {
      return {
        success: true,
        response: searchTerm
          ? `I couldn't find any assets matching "${searchTerm}".`
          : "You don't have any assets yet. Would you like to add one?",
        followUpActions: ["add_asset"],
      }
    }

    const assetList = assets
      .map((a: AssetRow) => {
        const value = a.current_value ? `$${a.current_value.toLocaleString()}` : "N/A"
        return `${a.name} (${a.asset_type}) - Status: ${a.status}, Value: ${value}`
      })
      .join("; ")

    return {
      success: true,
      response: `I found ${assets.length} asset${assets.length > 1 ? "s" : ""}: ${assetList}`,
      data: assets,
      followUpActions: ["get_asset_details", "get_asset_insights"],
    }
  }

  private async handleGetDashboardMetrics(intent: Intent, context: CommandContext): Promise<CommandResult> {
    const metricType = intent.entities.metric_type || "all"

    const [assetsResult, agentsResult, workflowsResult, tokensResult] = await Promise.all([
      this.supabase.from("assets").select("id, current_value", { count: "exact" }).eq("user_id", context.userId),
      this.supabase.from("ai_agents").select("id", { count: "exact" }).eq("user_id", context.userId),
      this.supabase.from("ai_workflows").select("id", { count: "exact" }).eq("user_id", context.userId),
      this.supabase.from("asset_tokens").select("id, token_supply", { count: "exact" }).eq("user_id", context.userId),
    ])

    const totalAssetValue = assetsResult.data?.reduce((sum: number, asset: { current_value: number | null }) => sum + (asset.current_value || 0), 0) || 0

    const metrics = {
      assets: assetsResult.count || 0,
      agents: agentsResult.count || 0,
      workflows: workflowsResult.count || 0,
      tokens: tokensResult.count || 0,
      totalAssetValue,
    }

    let response = ""
    if (metricType === "all") {
      response = `Here's your dashboard overview: You have ${metrics.assets} assets worth $${totalAssetValue.toLocaleString()}, ${metrics.agents} AI agents, ${metrics.workflows} workflows, and ${metrics.tokens} tokenized assets.`
    } else if (metricType === "assets") {
      response = `You have ${metrics.assets} assets with a total value of $${totalAssetValue.toLocaleString()}.`
    } else if (metricType === "agents") {
      response = `You have ${metrics.agents} AI agents configured.`
    } else {
      response = `Your ${metricType} metrics: ${JSON.stringify(metrics)}`
    }

    return {
      success: true,
      response,
      data: metrics,
      followUpActions: ["generate_report", "view_dashboard"],
    }
  }

  private async handleHelp(intent: Intent, context: CommandContext): Promise<CommandResult> {
    const helpTopic = intent.entities.topic || "general"

    const helpMessages = {
      general: `I can help you with: executing AI agents, managing assets, creating workflows, tokenizing assets, viewing dashboard metrics, and generating reports. What would you like to do?`,
      agents: `For AI agents, you can say: "Run my Asset Analyzer agent", "Create a new agent", "Show my agents", or "Delete the Market Trends agent".`,
      assets: `For assets, try: "Show my assets", "Add a new asset", "What's the status of my warehouse equipment?", or "Get insights for asset X".`,
      workflows: `For workflows: "Create a workflow", "Run my inventory workflow", or "Show my workflows".`,
      tokenization: `For tokenization: "Tokenize my warehouse asset", "Show my tokens", or "Create fractional tokens for asset X".`,
    }

    return {
      success: true,
      response: helpMessages[helpTopic as keyof typeof helpMessages] || helpMessages.general,
      followUpActions: ["try_command"],
    }
  }

  private async getPendingAction(context: CommandContext): Promise<PendingAction | null> {
    const admin = createAdminSupabaseClient()
    const { data: lastLog } = await admin
      .from("voice_execution_logs")
      .select("execution_result, created_at")
      .eq("user_id", context.userId)
      .eq("session_id", context.sessionId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()

    const pending = lastLog?.execution_result?.pendingAction as PendingAction | undefined
    if (!pending || !lastLog) return null

    const ageMs = Date.now() - new Date(lastLog.created_at).getTime()
    return ageMs <= PENDING_ACTION_TTL_MS ? pending : null
  }

  private async resolveAgentModel(requested?: string): Promise<{ id: string; label: string } | null> {
    const admin = createAdminSupabaseClient()
    const { data: models } = await admin
      .from("ai_models")
      .select("id, model_id, provider")
      .eq("is_active", true)
      .eq("type", "chat")
      .order("model_id")

    if (!models || models.length === 0) return null

    const wanted = requested?.trim().toLowerCase()
    const match =
      (wanted && models.find((m: { model_id: string }) => m.model_id.toLowerCase() === wanted)) ||
      (wanted && models.find((m: { model_id: string }) => m.model_id.toLowerCase().includes(wanted))) ||
      models.find((m: { model_id: string }) => m.model_id === DEFAULT_AGENT_MODEL) ||
      models[0]

    return { id: match.id, label: match.model_id }
  }

  private async draftAgent(purpose: string, nameHint?: string): Promise<AgentDraft | null> {
    const prompt = `You design AI agents for the Kronova platform from a spoken request.

REQUEST: "${purpose}"
${nameHint ? `REQUESTED NAME: "${nameHint}"` : ""}

AVAILABLE TOOLS (choose only from this list, only those the agent needs): ${VOICE_AGENT_TOOLS.join(", ")}

Return ONLY valid JSON:
{
  "name": "short Title Case name, 3-60 characters",
  "description": "one sentence",
  "system_prompt": "clear instructions for the agent: role, responsibilities, how to use its tools, what to do when unsure, and a rule to never take destructive action without asking",
  "tools": ["tool_name"],
  "category": "one lowercase word, e.g. devops, finance, logistics, analytics, general",
  "temperature": 0.3
}`

    try {
      const result = await generateText({
        model: "openai/gpt-4o-mini",
        prompt,
        maxOutputTokens: 900,
        temperature: 0.4,
      })
      const jsonMatch = result.text.match(/\{[\s\S]*\}/)
      if (!jsonMatch) return null
      const parsed = JSON.parse(jsonMatch[0])

      const name = String(nameHint || parsed.name || "").trim().slice(0, 255)
      const systemPrompt = String(parsed.system_prompt || "").trim()
      if (name.length < 3 || systemPrompt.length < 3) return null

      const tools = Array.isArray(parsed.tools)
        ? parsed.tools.filter((t: unknown): t is string => typeof t === "string" && (VOICE_AGENT_TOOLS as readonly string[]).includes(t))
        : []
      const temperature = Math.min(Math.max(Number(parsed.temperature) || 0.3, 0), 1)

      return {
        name,
        description: String(parsed.description || "").trim(),
        system_prompt: systemPrompt,
        tools,
        category: String(parsed.category || "general").toLowerCase().slice(0, 50),
        temperature,
        max_tokens: 2000,
      }
    } catch (error) {
      console.error("[CommandRouter] Agent draft failed:", error)
      return null
    }
  }

  private async handleCreateAgent(intent: Intent, context: CommandContext): Promise<CommandResult> {
    const purpose = intent.entities.purpose || intent.entities.description || intent.entities.prompt
    const nameHint = intent.entities.agent_name

    if (!purpose && !nameHint) {
      return {
        success: false,
        response: "What should the new agent do? For example, a DevOps agent that monitors deployments and summarizes failures.",
      }
    }

    const draft = await this.draftAgent(purpose || `An agent named ${nameHint}`, nameHint)
    if (!draft) {
      return {
        success: false,
        response: "I couldn't put that agent together. Could you describe what it should do once more?",
      }
    }

    const model = await this.resolveAgentModel(intent.entities.model)
    if (!model) {
      return { success: false, response: "There are no active chat models available to run an agent." }
    }

    const admin = createAdminSupabaseClient()
    const { data: existing } = await admin
      .from("ai_agents")
      .select("id")
      .eq("user_id", context.userId)
      .ilike("name", draft.name)
      .maybeSingle()

    if (existing) {
      return {
        success: false,
        response: `You already have an agent called ${draft.name}. Say a different name and I'll set it up.`,
      }
    }

    const toolSummary = draft.tools.length > 0 ? `with ${draft.tools.join(", ").replace(/_/g, " ")}` : "with no tools"
    const pendingAction: PendingAction = { kind: "create_agent", draft, modelId: model.id, modelLabel: model.label }

    return {
      success: true,
      response: `I'll create ${draft.name}, ${draft.description || "a custom agent"}, running on ${model.label} ${toolSummary}. Should I go ahead?`,
      data: { pendingAction },
      followUpActions: ["confirm", "cancel"],
    }
  }

  private async handleConfirmAction(context: CommandContext): Promise<CommandResult> {
    const pending = await this.getPendingAction(context)
    if (!pending) {
      return { success: false, response: "There's nothing waiting for confirmation. What would you like to do?" }
    }

    if (pending.kind === "create_agent") {
      const admin = createAdminSupabaseClient()

      const { data: duplicate } = await admin
        .from("ai_agents")
        .select("id")
        .eq("user_id", context.userId)
        .ilike("name", pending.draft.name)
        .maybeSingle()

      if (duplicate) {
        return {
          success: true,
          response: `${pending.draft.name} already exists, so I didn't create a second copy.`,
          data: { agentId: duplicate.id, agentName: pending.draft.name },
        }
      }

      const { data: agent, error } = await admin
        .from("ai_agents")
        .insert({
          ...pending.draft,
          model_id: pending.modelId,
          user_id: context.userId,
          is_active: true,
          parameters: {},
        })
        .select("id, name")
        .single()

      if (error || !agent) {
        return {
          success: false,
          response: "I wasn't able to save that agent. Please try again.",
          error: error?.message,
        }
      }

      return {
        success: true,
        response: `Done. ${agent.name} is ready. You can say "run ${agent.name}" followed by what you want it to do.`,
        data: { agentId: agent.id, agentName: agent.name },
        followUpActions: ["execute_agent", "list_agents"],
      }
    }

    return {
      success: true,
      response: `${pending.assetName} is ready to tokenize. Minting on Sui needs your wallet signature, so open the tokenization page to approve it there.`,
      data: {
        handoff: {
          type: "wallet_signature_required",
          assetId: pending.assetId,
          assetName: pending.assetName,
          walletAddress: pending.walletAddress,
          path: "/ai-suite/tokenization",
        },
      },
      followUpActions: ["open_tokenization"],
    }
  }

  private async handleCancelAction(context: CommandContext): Promise<CommandResult> {
    const pending = await this.getPendingAction(context)
    return {
      success: true,
      response: pending ? "Okay, I've cancelled that." : "There was nothing to cancel.",
    }
  }

  private async handleUpdateAgent(intent: Intent, context: CommandContext): Promise<CommandResult> {
    return {
      success: false,
      response: "Updating agents via voice is in development. Please use the web dashboard.",
      followUpActions: ["open_dashboard"],
    }
  }

  private async handleDeleteAgent(intent: Intent, context: CommandContext): Promise<CommandResult> {
    return {
      success: false,
      response: "Deleting agents via voice requires confirmation. Please use the web dashboard for this action.",
      followUpActions: ["open_dashboard"],
    }
  }

  private async handleTokenizeAsset(intent: Intent, context: CommandContext): Promise<CommandResult> {
    const assetName = intent.entities.asset_name
    if (!assetName) {
      return { success: false, response: "Which asset would you like to tokenize?", followUpActions: ["query_assets"] }
    }

    const admin = createAdminSupabaseClient()
    const { data: matches } = await admin
      .from("assets")
      .select("id, name, asset_type, current_value")
      .eq("user_id", context.userId)
      .ilike("name", `%${assetName}%`)
      .limit(5)

    if (!matches || matches.length === 0) {
      return {
        success: false,
        response: `I couldn't find an asset named "${assetName}".`,
        followUpActions: ["query_assets"],
      }
    }

    if (matches.length > 1) {
      const names = matches.map((a: { name: string }) => a.name).join(", ")
      return { success: false, response: `I found several matches: ${names}. Which one do you mean?` }
    }

    const asset = matches[0] as { id: string; name: string; asset_type: string; current_value: number | null }

    const { data: existingToken } = await admin
      .from("asset_tokens")
      .select("id")
      .eq("asset_id", asset.id)
      .eq("status", "active")
      .maybeSingle()

    if (existingToken) {
      return { success: false, response: `${asset.name} is already tokenized.` }
    }

    const value = asset.current_value ? ` valued at $${asset.current_value.toLocaleString()}` : ""
    const pendingAction: PendingAction = {
      kind: "tokenize_asset",
      assetId: asset.id,
      assetName: asset.name,
      walletAddress: intent.entities.wallet_address,
    }

    return {
      success: true,
      response: `${asset.name}, a ${asset.asset_type}${value}, is eligible for tokenization. Shall I prepare it for signing?`,
      data: { pendingAction },
      followUpActions: ["confirm", "cancel"],
    }
  }

  private async handleCreateWorkflow(intent: Intent, context: CommandContext): Promise<CommandResult> {
    return {
      success: false,
      response: "Creating workflows via voice is in development. Please use the workflows dashboard.",
      followUpActions: ["open_workflows"],
    }
  }

  private async handleExecuteWorkflow(intent: Intent, context: CommandContext): Promise<CommandResult> {
    return {
      success: false,
      response: "Executing workflows via voice is coming soon. Please use the workflows dashboard for now.",
      followUpActions: ["open_workflows"],
    }
  }

  private async handleGenerateReport(intent: Intent, context: CommandContext): Promise<CommandResult> {
    return {
      success: false,
      response: "Report generation via voice is in development. Please use the analytics dashboard.",
      followUpActions: ["open_analytics"],
    }
  }

  private async handleUpdateAsset(intent: Intent, context: CommandContext): Promise<CommandResult> {
    return {
      success: false,
      response: "Updating assets via voice is in development. Please use the asset management interface.",
      followUpActions: ["open_assets"],
    }
  }

  private async handleAddAsset(intent: Intent, context: CommandContext): Promise<CommandResult> {
    return {
      success: false,
      response: "Adding assets via voice is in development. Please use the asset creation form.",
      followUpActions: ["open_assets"],
    }
  }

  private async handleGetAssetInsights(intent: Intent, context: CommandContext): Promise<CommandResult> {
    const assetName = intent.entities.asset_name

    if (!assetName) {
      return {
        success: false,
        response: "Which asset would you like insights for?",
      }
    }

    const { data: asset } = await this.supabase
      .from("assets")
      .select("id, name")
      .eq("user_id", context.userId)
      .ilike("name", `%${assetName}%`)
      .maybeSingle()

    if (!asset) {
      return {
        success: false,
        response: `I couldn't find an asset named "${assetName}".`,
        followUpActions: ["query_assets"],
      }
    }

    const { data: insights } = await this.supabase
      .from("asset_intelligence_insights")
      .select("*")
      .eq("asset_id", asset.id)
      .order("created_at", { ascending: false })
      .limit(3)

    if (!insights || insights.length === 0) {
      return {
        success: true,
        response: `I don't have any AI insights for ${asset.name} yet. Would you like me to generate some?`,
        followUpActions: ["generate_insights"],
      }
    }

    const insightSummary = insights.map((i: { insight_type: string; priority: string }) => `${i.insight_type}: ${i.priority} priority`).join("; ")

    return {
      success: true,
      response: `Here are the latest insights for ${asset.name}: ${insightSummary}`,
      data: insights,
      followUpActions: ["view_full_insights", "generate_new_insights"],
    }
  }

  private async handleManageIntegrations(intent: Intent, context: CommandContext): Promise<CommandResult> {
    return {
      success: false,
      response: "Managing integrations via voice is in development. Please use the integrations dashboard.",
      followUpActions: ["open_integrations"],
    }
  }

  private async handleVoiceSettings(intent: Intent, context: CommandContext): Promise<CommandResult> {
    return {
      success: false,
      response: "Voice settings configuration is in development. Please use the settings page.",
      followUpActions: ["open_settings"],
    }
  }
}

export async function routeVoiceCommand(intent: Intent, context: CommandContext): Promise<CommandResult> {
  const router = new CommandRouter()
  return await router.routeCommand(intent, context)
}
