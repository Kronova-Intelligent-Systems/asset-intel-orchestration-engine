"use client"

import { useQuery, useQueryClient } from "@tanstack/react-query"
import { getSupabaseClient } from "@/lib/supabase/singleton"
import type {
  AIModel,
  AIAgent,
  AIWorkflow,
  AIWorkflowRun,
  AIAnalysisResult,
  Asset,
  AssetIntelligenceAgentTemplate,
  AssetAgentConfig,
  AssetWorkflow,
  DataEmbedding,
  SystemAIAgent,
  AIModelSummary,
  AIAgentSummary,
  AIWorkflowSummary,
  TokenizedAsset,
  TokenOffer,
  TokenTransaction,
  FractionalOwnership,
} from "@/lib/schemas/ai-suite"

// AI Models Hooks
export function useAIModels() {
  const supabase = getSupabaseClient()

  return useQuery({
    queryKey: ["ai-models"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ai_models")
        .select("*")
        .eq("is_active", true)
        .order("created_at", { ascending: false })

      if (error) throw new Error(error.message)
      return data as AIModel[]
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  })
}

// AI Agents Hooks
export function useAIAgents() {
  const supabase = getSupabaseClient()

  return useQuery({
    queryKey: ["ai-agents"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ai_agents")
        .select(`
          *,
          ai_models (
            id,
            name,
            provider,
            model_id
          )
        `)
        .eq("is_active", true)
        .order("created_at", { ascending: false })

      if (error) throw new Error(error.message)
      return data as (AIAgent & { ai_models: AIModelSummary | null })[]
    },
    staleTime: 2 * 60 * 1000, // 2 minutes
  })
}

// AI Workflows Hooks
export function useAIWorkflows() {
  const supabase = getSupabaseClient()

  return useQuery({
    queryKey: ["ai-workflows"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ai_workflows")
        .select("*")
        .eq("is_active", true)
        .order("created_at", { ascending: false })

      if (error) throw new Error(error.message)
      return data as AIWorkflow[]
    },
    staleTime: 3 * 60 * 1000, // 3 minutes
  })
}

// AI Workflow Runs Hooks
export function useAIWorkflowRuns(workflowId?: string) {
  const supabase = getSupabaseClient()

  return useQuery({
    queryKey: ["ai-workflow-runs", workflowId],
    queryFn: async () => {
      let query = supabase
        .from("ai_workflow_runs")
        .select(`
          *,
          ai_workflows (
            id,
            name,
            description
          )
        `)
        .order("created_at", { ascending: false })
        .limit(50)

      if (workflowId) {
        query = query.eq("workflow_id", workflowId)
      }

      const { data, error } = await query

      if (error) throw new Error(error.message)
      return data as (AIWorkflowRun & { ai_workflows: AIWorkflowSummary | null })[]
    },
    staleTime: 30 * 1000, // 30 seconds for real-time feel
  })
}

// AI Analysis Results Hooks
export function useAIAnalysisResults(sourceType?: string, sourceId?: string) {
  const supabase = getSupabaseClient()

  return useQuery({
    queryKey: ["ai-analysis-results", sourceType, sourceId],
    queryFn: async () => {
      let query = supabase
        .from("ai_analysis_results")
        .select(`
          *,
          ai_agents (
            id,
            name,
            description
          )
        `)
        .order("created_at", { ascending: false })
        .limit(100)

      if (sourceType) {
        query = query.eq("source_type", sourceType)
      }
      if (sourceId) {
        query = query.eq("source_id", sourceId)
      }

      const { data, error } = await query

      if (error) throw new Error(error.message)
      return data as (AIAnalysisResult & { ai_agents: AIAgentSummary | null })[]
    },
    staleTime: 60 * 1000, // 1 minute
  })
}

// Assets Hooks
export function useAssets() {
  const supabase = getSupabaseClient()

  return useQuery({
    queryKey: ["assets"],
    queryFn: async () => {
      const { data, error } = await supabase.from("assets").select("*").order("created_at", { ascending: false })

      if (error) throw new Error(error.message)
      return data as Asset[]
    },
    staleTime: 2 * 60 * 1000, // 2 minutes
  })
}

// Asset Intelligence Agent Templates Hooks
export function useAssetIntelligenceAgentTemplates() {
  const supabase = getSupabaseClient()

  return useQuery({
    queryKey: ["asset-intelligence-agent-templates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("asset_intelligence_agent_templates")
        .select("*")
        .eq("is_active", true)
        .order("category", { ascending: true })

      if (error) throw new Error(error.message)
      return data as AssetIntelligenceAgentTemplate[]
    },
    staleTime: 10 * 60 * 1000, // 10 minutes (templates don't change often)
  })
}

// Asset Agent Configs Hooks
export function useAssetAgentConfigs() {
  const supabase = getSupabaseClient()

  return useQuery({
    queryKey: ["asset-agent-configs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("asset_agent_configs")
        .select(`
          *,
          ai_agents (
            id,
            name,
            description
          )
        `)
        .order("created_at", { ascending: false })

      if (error) throw new Error(error.message)
      return data as (AssetAgentConfig & { ai_agents: AIAgentSummary | null })[]
    },
    staleTime: 2 * 60 * 1000, // 2 minutes
  })
}

// Asset Workflows Hooks
export function useAssetWorkflows() {
  const supabase = getSupabaseClient()

  return useQuery({
    queryKey: ["asset-workflows"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("asset_workflows")
        .select("*")
        .eq("is_active", true)
        .order("created_at", { ascending: false })

      if (error) throw new Error(error.message)
      return data as AssetWorkflow[]
    },
    staleTime: 3 * 60 * 1000, // 3 minutes
  })
}

// Data Embeddings Hooks
export function useDataEmbeddings() {
  const supabase = getSupabaseClient()

  return useQuery({
    queryKey: ["data-embeddings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("data_embeddings")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100)

      if (error) throw new Error(error.message)
      return data as DataEmbedding[]
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  })
}

// System AI Agents Hooks
export function useSystemAIAgents() {
  const supabase = getSupabaseClient()

  return useQuery({
    queryKey: ["system-ai-agents"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("system_agent_templates")
        .select("*")
        .eq("is_active", true)
        .order("created_at", { ascending: false })

      if (error) throw new Error(error.message)
      return data as SystemAIAgent[]
    },
    staleTime: 10 * 60 * 1000, // 10 minutes
  })
}

// Tokenized Assets Hooks
export function useTokenizedAssets() {
  const supabase = getSupabaseClient()

  return useQuery({
    queryKey: ["tokenized-assets"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("asset_tokens")
        .select(`
          *,
          assets (
            id,
            name,
            asset_type,
            current_value,
            metadata
          )
        `)
        .order("created_at", { ascending: false })

      if (error) throw new Error(error.message)
      return data as TokenizedAsset[]
    },
    staleTime: 2 * 60 * 1000, // 2 minutes
  })
}

// Token Trading Offers Hooks
export function useTokenOffers(status?: string) {
  const supabase = getSupabaseClient()

  return useQuery({
    queryKey: ["token-offers", status],
    queryFn: async () => {
      let query = supabase
        .from("token_offers")
        .select(`
          *,
          asset_tokens (
            id,
            token_id,
            token_type
          )
        `)
        .order("created_at", { ascending: false })

      if (status) {
        query = query.eq("status", status)
      }

      const { data, error } = await query

      if (error) throw new Error(error.message)
      return data as TokenOffer[]
    },
    staleTime: 30 * 1000, // 30 seconds for real-time feel
  })
}

// Token Transactions Hooks
export function useTokenTransactions(userId?: string) {
  const supabase = getSupabaseClient()

  return useQuery({
    queryKey: ["token-transactions", userId],
    queryFn: async () => {
      let query = supabase
        .from("token_transactions")
        .select(`
          *,
          asset_tokens (
            id,
            token_id,
            token_type
          )
        `)
        .order("created_at", { ascending: false })
        .limit(100)

      if (userId) {
        query = query.or(`from_user_id.eq.${userId},to_user_id.eq.${userId}`)
      }

      const { data, error } = await query

      if (error) throw new Error(error.message)
      return data as TokenTransaction[]
    },
    staleTime: 30 * 1000, // 30 seconds
  })
}

// Fractional Ownership Hooks
export function useFractionalOwnership(userId?: string) {
  const supabase = getSupabaseClient()

  return useQuery({
    queryKey: ["fractional-ownership", userId],
    queryFn: async () => {
      let query = supabase
        .from("fractional_ownerships")
        .select("*")
        .order("created_at", { ascending: false })

      if (userId) {
        query = query.eq("user_id", userId)
      }

      const { data, error } = await query

      if (error) throw new Error(error.message)
      return data as FractionalOwnership[]
    },
    staleTime: 2 * 60 * 1000, // 2 minutes
  })
}

// Token Analytics Hook
export function useTokenizationMetrics() {
  const supabase = getSupabaseClient()

  return useQuery({
    queryKey: ["tokenization-metrics"],
    queryFn: async () => {
      const [tokenizedAssetsResult, offersResult, transactionsResult, ownershipResult] = await Promise.all([
        supabase.from("asset_tokens").select("id"),
        supabase.from("token_offers").select("id, status, total_price"),
        supabase
          .from("token_transactions")
          .select("id, transaction_type, fraction_count, price, created_at")
          .gte("created_at", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()),
        supabase.from("fractional_ownerships").select("id, fraction_count"),
      ])

      const tokenizedAssets = tokenizedAssetsResult.data || []
      const offers = offersResult.data || []
      const transactions = transactionsResult.data || []
      const ownership = ownershipResult.data || []

      const totalTokenizedAssets = tokenizedAssets.length

      const activeOffers = offers.filter((offer) => offer.status === "active").length
      const totalOfferVolume = offers
        .filter((offer) => offer.status === "active")
        .reduce((sum, offer) => sum + (offer.total_price ?? 0), 0)

      const recentTransactionVolume = transactions.reduce((sum, tx) => sum + (tx.price ?? 0), 0)

      const totalSharesDistributed = ownership.reduce((sum, own) => sum + (own.fraction_count ?? 0), 0)

      return {
        totalTokenizedAssets,
        totalTokenValue: 0, // Calculated from asset values
        fractionalizedAssets: 0, // Count from fractionalization_pools
        activeOffers,
        totalOfferVolume,
        recentTransactionVolume,
        totalTokenSupply: tokenizedAssets.length,
        totalSharesDistributed,
        avgTokenPrice: 0,
      }
    },
    refetchInterval: 30 * 1000, // Refresh every 30 seconds
    staleTime: 15 * 1000, // Consider stale after 15 seconds
  })
}

// Real-time Dashboard Metrics Hook
export function useDashboardMetrics() {
  const supabase = getSupabaseClient()

  return useQuery({
    queryKey: ["dashboard-metrics"],
    queryFn: async () => {
      // Fetch all metrics in parallel
      const [
        agentsResult,
        workflowsResult,
        workflowRunsResult,
        assetsResult,
        iotSensorsResult,
        analysisResult,
        embeddingsResult,
        tokenizedAssetsResult,
      ] = await Promise.all([
        supabase.from("ai_agents").select("id, is_active").eq("is_active", true),
        supabase.from("ai_workflows").select("id, is_active").eq("is_active", true),
        supabase
          .from("ai_workflow_runs")
          .select("id, status, created_at")
          .gte("created_at", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()),
        supabase.from("assets").select("id, current_value, status, esg_metrics"),
        supabase.from("iot_sensor_data").select("iot_sensor_id").limit(1000),
        supabase
          .from("ai_analysis_results")
          .select("id, created_at")
          .gte("created_at", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()),
        supabase.from("data_embeddings").select("id, created_at"),
        supabase.from("asset_tokens").select("id"),
      ])

      // Calculate metrics
      const totalAgents = agentsResult.data?.length || 0
      const activeWorkflows = workflowsResult.data?.length || 0
      const recentRuns = workflowRunsResult.data || []
      const assets = assetsResult.data || []
      const iotSensors = iotSensorsResult.data || []
      const recentAnalysis = analysisResult.data || []
      const embeddings = embeddingsResult.data || []
      const tokenizedAssets = tokenizedAssetsResult.data || []

      const successfulRuns = recentRuns.filter((run) => run.status === "completed").length
      const totalRuns = recentRuns.length
      const successRate = totalRuns > 0 ? (successfulRuns / totalRuns) * 100 : 0

      const regularAssetsCount = assets.length
      const uniqueIotSensors = new Set(iotSensors.map((sensor) => sensor.iot_sensor_id))
      const iotSensorsCount = uniqueIotSensors.size
      const totalAssets = regularAssetsCount + iotSensorsCount

      console.log(
        "[v0] Dashboard metrics - Total assets:",
        regularAssetsCount,
        "IoT sensors:",
        iotSensorsCount,
        "Combined:",
        totalAssets,
      )

      const totalAssetValue = assets.reduce((sum, asset) => sum + (asset.current_value || 0), 0)

      // Calculate average ESG score
      const assetsWithEsg = assets.filter(
        (asset) => asset.esg_metrics && typeof asset.esg_metrics === "object" && "score" in asset.esg_metrics,
      )
      const avgEsgScore =
        assetsWithEsg.length > 0
          ? assetsWithEsg.reduce((sum, asset) => sum + (asset.esg_metrics as any).score, 0) / assetsWithEsg.length
          : 0

      const activeAssets = assets.filter((asset) => asset.status === "active").length
      const avgUtilization = totalAssets > 0 ? (activeAssets / totalAssets) * 100 : 0

      return {
        totalAgents,
        activeWorkflows,
        totalRequests: totalRuns,
        successRate: Math.round(successRate * 10) / 10,
        avgResponseTime: 245, // This would come from actual performance metrics
        costSavings: 45600, // This would be calculated from actual usage data
        totalAssets,
        assetValue: totalAssetValue,
        avgUtilization: Math.round(avgUtilization * 10) / 10,
        esgScore: Math.round(avgEsgScore * 10) / 10,
        recentAnalysis: recentAnalysis.length,
        totalEmbeddings: embeddings.length,
        recentWorkflowRuns: recentRuns.slice(0, 10), // Latest 10 runs
        totalTokenizedAssets: tokenizedAssets.length,
      }
    },
    refetchInterval: 30 * 1000, // Refresh every 30 seconds
    staleTime: 15 * 1000, // Consider stale after 15 seconds
  })
}

// AI Request Logs Hooks
export function useAIRequestLogs(limit = 100) {
  const supabase = getSupabaseClient()

  return useQuery({
    queryKey: ["ai-request-logs", limit],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ai_request_logs")
        .select(`
          *,
          ai_agents (
            name,
            description
          ),
          ai_models (
            name,
            provider
          )
        `)
        .order("created_at", { ascending: false })
        .limit(limit)

      if (error) throw new Error(error.message)
      return data || []
    },
    staleTime: 30 * 1000, // 30 seconds
  })
}

// Voice Execution Logs Hooks
export function useVoiceExecutionLogs(limit = 100) {
  const supabase = getSupabaseClient()

  return useQuery({
    queryKey: ["voice-execution-logs", limit],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("voice_execution_logs")
        .select(`
          *,
          ai_agents (
            name,
            description
          )
        `)
        .order("created_at", { ascending: false })
        .limit(limit)

      if (error) throw new Error(error.message)
      return data || []
    },
    staleTime: 30 * 1000, // 30 seconds
  })
}

// AI Logs Statistics Hook
export function useAILogsStatistics() {
  const supabase = getSupabaseClient()

  return useQuery({
    queryKey: ["ai-logs-statistics"],
    queryFn: async () => {
      const [aiRequestsResult, voiceRequestsResult, aiResultsResult, tokensResult, execTimeResult] =
        await Promise.all([
          supabase.from("ai_request_logs").select("id", { count: "exact", head: true }),
          supabase.from("voice_execution_logs").select("id", { count: "exact", head: true }),
          supabase.from("ai_analysis_results").select("id", { count: "exact", head: true }),
          supabase.from("ai_request_logs").select("tokens_used"),
          supabase.from("ai_agent_runs").select("execution_time_ms").not("execution_time_ms", "is", null),
        ])

      const totalTokens = tokensResult.data?.reduce((sum, item) => sum + (item.tokens_used || 0), 0) || 0
      const execTimes = execTimeResult.data || []
      const avgExecutionTime =
        execTimes.length > 0
          ? execTimes.reduce((sum, item) => sum + (item.execution_time_ms || 0), 0) / execTimes.length
          : 0

      return {
        totalAIRequests: aiRequestsResult.count || 0,
        totalVoiceRequests: voiceRequestsResult.count || 0,
        totalAIResults: aiResultsResult.count || 0,
        totalTokensUsed: totalTokens,
        avgExecutionTimeMs: Math.round(avgExecutionTime),
      }
    },
    staleTime: 60 * 1000, // 1 minute
  })
}

// Real-time subscription hook for live updates
export function useRealtimeSubscription(table: string, callback: () => void) {
  const supabase = getSupabaseClient()
  const queryClient = useQueryClient()

  return useQuery({
    queryKey: [`realtime-${table}`],
    queryFn: async () => {
      const channel = supabase
        .channel(`realtime-${table}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: table,
          },
          (payload) => {
            console.log(`[v0] Realtime update for ${table}:`, payload)
            // Invalidate relevant queries
            queryClient.invalidateQueries({ queryKey: [table] })
            queryClient.invalidateQueries({ queryKey: ["dashboard-metrics"] })
            callback()
          },
        )
        .subscribe()

      return channel
    },
    staleTime: Number.POSITIVE_INFINITY, // Never consider stale
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  })
}
