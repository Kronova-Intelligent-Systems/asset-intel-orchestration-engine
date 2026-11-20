import { generateText } from "ai"

export type IntentAction =
  | "execute_agent"
  | "query_assets"
  | "create_agent"
  | "update_agent"
  | "delete_agent"
  | "tokenize_asset"
  | "create_workflow"
  | "execute_workflow"
  | "get_dashboard_metrics"
  | "generate_report"
  | "update_asset"
  | "add_asset"
  | "get_asset_insights"
  | "manage_integrations"
  | "voice_settings"
  | "help"
  | "confirm_action"
  | "cancel_action"
  | "unknown"

export interface Intent {
  action: IntentAction
  entities: Record<string, any>
  confidence: number
  suggestedResponse?: string
}

export interface EntityExtractionResult {
  entityType: string
  value: any
  confidence: number
  position: { start: number; end: number }
}

export interface IntentClassificationOptions {
  maxIterations?: number
  timeoutMs?: number
  useCache?: boolean
}

export class NLPIntentClassifier {
  private intentCache: Map<string, Intent>

  constructor() {
    this.intentCache = new Map()
  }

  async classifyIntent(
    text: string,
    context?: Record<string, any>,
    options?: IntentClassificationOptions,
  ): Promise<Intent> {
    // Check cache first
    const useCache = options?.useCache !== false
    const cacheKey = `${text}:${JSON.stringify(context)}`

    if (useCache && this.intentCache.has(cacheKey)) {
      return this.intentCache.get(cacheKey)!
    }

    const intent = await this.extractIntent(text, context, options)

    // Cache result
    if (useCache) {
      this.intentCache.set(cacheKey, intent)

      // Limit cache size
      if (this.intentCache.size > 1000) {
        const firstKey = this.intentCache.keys().next().value
        if (firstKey !== undefined) this.intentCache.delete(firstKey)
      }
    }

    return intent
  }

  private async extractIntent(
    text: string,
    context?: Record<string, any>,
    options?: IntentClassificationOptions,
  ): Promise<Intent> {
    const prompt = `You are an advanced NLP intent classifier for the Kronova platform.

AVAILABLE ACTIONS:
1. execute_agent - Run an AI agent with a prompt
2. query_assets - Search or retrieve asset information
3. create_agent - Create a new AI agent
4. update_agent - Modify existing agent settings
5. delete_agent - Remove an agent
6. tokenize_asset - Create blockchain tokens for assets
7. create_workflow - Build a new workflow
8. execute_workflow - Run a workflow
9. get_dashboard_metrics - Retrieve platform statistics
10. generate_report - Create analytics reports
11. update_asset - Modify asset information
12. add_asset - Create new asset
13. get_asset_insights - Get AI insights for assets
14. manage_integrations - Configure platform integrations
15. voice_settings - Adjust voice agent settings
16. help - Get help or information
17. confirm_action - User agrees to the action the assistant just proposed ("yes", "go ahead", "do it", "confirm")
18. cancel_action - User declines or abandons the action the assistant just proposed ("no", "cancel", "never mind")
19. unknown - Cannot determine intent

ENTITY TYPES:
- purpose: For create_agent, what the new agent should do, in the user's own words (e.g. "monitor deployments and summarize failed builds")
- model: For create_agent, a model the user asked for by name, if any
- wallet_address: For tokenize_asset, a wallet address if the user states one
- agent_name: Name of AI agent
- asset_name: Name of asset
- workflow_name: Name of workflow
- query/prompt: User's question or command
- number: Numeric values
- date: Date/time references
- status: Status values (active, inactive, etc.)
- metric_type: Type of metric (count, value, etc.)

USER INPUT: "${text}"

${context ? `CONTEXT:\n${JSON.stringify(context, null, 2)}` : ""}

CLASSIFICATION RULES:
- Use context to disambiguate unclear commands
- Extract ALL relevant entities with positions
- Assign confidence based on clarity (0.0-1.0)
- If intent is unclear, suggest clarifying questions
- Map synonyms to standard actions (e.g., "run" → "execute")

Return ONLY valid JSON in this exact format:
{
  "action": "action_name",
  "entities": {
    "entity_name": "value"
  },
  "confidence": 0.95,
  "suggestedResponse": "optional clarification question"
}`

    try {
      const result = await generateText({
        model: "openai/gpt-4o-mini",
        prompt,
        maxOutputTokens: 500,
        temperature: 0.3,
      })

      let parsed: any
      try {
        // Try to extract JSON from response
        const jsonMatch = result.text.match(/\{[\s\S]*\}/)
        if (jsonMatch) {
          parsed = JSON.parse(jsonMatch[0])
        } else {
          parsed = JSON.parse(result.text)
        }
      } catch (parseError) {
        console.error("[NLP] JSON parse error:", parseError)
        return {
          action: "unknown",
          entities: { original_text: text },
          confidence: 0.1,
          suggestedResponse: "I didn't understand that. Could you rephrase?",
        }
      }

      const validatedIntent: Intent = {
        action: (parsed.action || "unknown") as IntentAction,
        entities: parsed.entities || {},
        confidence: Math.min(Math.max(parsed.confidence || 0.5, 0), 1),
        suggestedResponse: parsed.suggestedResponse,
      }

      return validatedIntent
    } catch (error) {
      console.error("[NLP] Intent classification error:", error)
      return {
        action: "unknown",
        entities: { error: error instanceof Error ? error.message : "Unknown error" },
        confidence: 0.0,
        suggestedResponse: "I encountered an error. Please try again.",
      }
    }
  }

  async extractEntities(text: string, entityTypes: string[]): Promise<EntityExtractionResult[]> {
    const prompt = `Extract the following entity types from the text:
${entityTypes.join(", ")}

Text: "${text}"

Return JSON array of entities with type, value, confidence, and position.
Format: [{"entityType": "agent_name", "value": "Asset Analyzer", "confidence": 0.95, "position": {"start": 4, "end": 18}}]`

    try {
      const result = await generateText({
        model: "openai/gpt-4o-mini",
        prompt,
        maxOutputTokens: 300,
        temperature: 0.2,
      })

      const jsonMatch = result.text.match(/\[[\s\S]*\]/)
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0])
        return Array.isArray(parsed) ? parsed : []
      }

      return []
    } catch (error) {
      console.error("[NLP] Entity extraction error:", error)
      return []
    }
  }

  clearCache(): void {
    this.intentCache.clear()
  }

  getCacheStats(): { size: number; maxSize: number } {
    return {
      size: this.intentCache.size,
      maxSize: 1000,
    }
  }
}

export async function classifyVoiceIntent(
  text: string,
  context?: Record<string, any>,
  options?: IntentClassificationOptions,
): Promise<Intent> {
  const classifier = new NLPIntentClassifier()
  return await classifier.classifyIntent(text, context, options)
}

export async function extractVoiceEntities(text: string, entityTypes: string[]): Promise<EntityExtractionResult[]> {
  const classifier = new NLPIntentClassifier()
  return await classifier.extractEntities(text, entityTypes)
}
