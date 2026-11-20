import type { createServerSupabaseClient } from "@/lib/supabase/server"
import type { AIModel, AIAgent, AIWorkflow, Asset, DataEmbedding, SystemAIAgent } from "@/lib/schemas/ai-suite"

export const getAIModels = (supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>) => ({
  queryKey: ["ai-models"],
  queryFn: async () => {
    const { data, error } = await supabase
      .from("ai_models")
      .select("*")
      .eq("is_active", true)
      .order("created_at", { ascending: false })

    if (error) throw new Error(error.message)
    return data || []
  },
})

// ============================================================================
// IOT FLEET QUERIES
// ============================================================================

export const getIoTFleetDevices = (
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  userId: string,
) => ({
  queryKey: ["iot-fleet-devices"],
  queryFn: async () => {
    const { data, error } = await supabase
      .from("iot_fleet_devices")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })

    if (error) throw new Error(error.message)
    return data || []
  },
})

export const getIoTFleetTelemetry = (
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  deviceId: string,
  limit = 100,
) => ({
  queryKey: ["iot-fleet-telemetry", deviceId, limit],
  queryFn: async () => {
    const { data, error } = await supabase
      .from("iot_fleet_telemetry")
      .select("*")
      .eq("device_id", deviceId)
      .order("recorded_at", { ascending: false })
      .limit(limit)

    if (error) throw new Error(error.message)
    return data || []
  },
})

export const getIoTFleetAlerts = (
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  userId: string,
  unresolvedOnly = false,
) => ({
  queryKey: ["iot-fleet-alerts", unresolvedOnly],
  queryFn: async () => {
    let query = supabase
      .from("iot_fleet_alerts")
      .select(`
        *,
        iot_fleet_devices (
          device_name,
          device_type,
          license_plate
        )
      `)
      .eq("user_id", userId)
      .order("triggered_at", { ascending: false })

    if (unresolvedOnly) {
      query = query.is("resolved_at", null)
    }

    const { data, error } = await query

    if (error) throw new Error(error.message)
    return data || []
  },
})

export const getIoTFleetDriverPerformance = (
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  userId: string,
) => ({
  queryKey: ["iot-fleet-driver-performance"],
  queryFn: async () => {
    const { data, error } = await supabase
      .from("iot_fleet_driver_performance")
      .select("*")
      .eq("driver_id", userId)
      .order("period_end", { ascending: false })
      .limit(12)

    if (error) throw new Error(error.message)
    return data || []
  },
})

export const getIoTFleetMetrics = (
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  userId: string,
) => ({
  queryKey: ["iot-fleet-metrics"],
  queryFn: async () => {
    const { data: devices, error: devicesError } = await supabase
      .from("iot_fleet_devices")
      .select("id, status, device_type, maintenance_status")
      .eq("user_id", userId)

    if (devicesError) throw new Error(devicesError.message)

    const totalDevices = devices?.length || 0
    const onlineDevices = devices?.filter(d => d.status === "online").length || 0
    const alertDevices = devices?.filter(d => d.status === "alert").length || 0
    const maintenanceNeeded = devices?.filter(d => 
      d.maintenance_status === "attention" || d.maintenance_status === "critical"
    ).length || 0

    const { count: unresolvedAlerts } = await supabase
      .from("iot_fleet_alerts")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .is("resolved_at", null)

    return {
      totalDevices,
      onlineDevices,
      offlineDevices: totalDevices - onlineDevices,
      alertDevices,
      maintenanceNeeded,
      unresolvedAlerts: unresolvedAlerts || 0,
    }
  },
})

// ============================================================================
// ROI ANALYTICS QUERIES
// ============================================================================

export const getROIAssessments = (
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  userId: string,
) => ({
  queryKey: ["roi-assessments"],
  queryFn: async () => {
    const { data, error } = await supabase
      .from("org_roi_baseline_data")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })

    if (error) throw new Error(error.message)
    return data || []
  },
})

export const getROIBenchmarks = (
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  industry?: string,
) => ({
  queryKey: ["roi-benchmarks", industry],
  queryFn: async () => {
    let query = supabase
      .from("org_roi_baseline_data")
      .select("*")
      .order("industry")

    if (industry) {
      query = query.eq("industry", industry)
    }

    const { data, error } = await query

    if (error) throw new Error(error.message)
    return data || []
  },
})

export const getROIHistoricalTrends = (
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  assessmentId: string,
) => ({
  queryKey: ["roi-historical-trends", assessmentId],
  queryFn: async () => {
    const { data, error } = await supabase
      .from("org_roi_baseline_data")
      .select("*")
      .eq("id", assessmentId)
      .order("baseline_date", { ascending: true })

    if (error) throw new Error(error.message)
    return data || []
  },
})


export const getAIAgents = (supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>, userId: string) => ({
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
      .eq("user_id", userId)
      .eq("is_active", true)
      .order("created_at", { ascending: false })

    if (error) throw new Error(error.message)
    return data as (AIAgent & { ai_models: AIModel })[]
  },
})

export const getAIWorkflows = (supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>, userId: string) => ({
  queryKey: ["ai-workflows"],
  queryFn: async () => {
    const { data, error } = await supabase
      .from("ai_workflows")
      .select("*")
      .eq("user_id", userId)
      .eq("is_active", true)
      .order("created_at", { ascending: false })

    if (error) throw new Error(error.message)
    return data as AIWorkflow[]
  },
})

export const getAssets = (supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>, userId: string) => ({
  queryKey: ["assets"],
  queryFn: async () => {
    const { data, error } = await supabase
      .from("assets")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })

    if (error) throw new Error(error.message)
    return data as Asset[]
  },
})

export const getDataEmbeddings = (supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>, userId: string) => ({
  queryKey: ["data-embeddings"],
  queryFn: async () => {
    const { data, error } = await supabase
      .from("data_embeddings")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(100)

    if (error) throw new Error(error.message)
    return data as DataEmbedding[]
  },
})

export const getSystemAIAgents = (supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>) => ({
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
})

export const getDashboardMetrics = (supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>, userId: string) => ({
  queryKey: ["dashboard-metrics"],
  queryFn: async () => {
    const [
      agentsResult,
      workflowsResult,
      workflowRunsResult,
      assetsResult,
      analysisResult,
      embeddingsResult,
      requestLogsResult,
      learningResult,
      iotSensorResult,
    ] = await Promise.all([
      supabase.from("ai_agents").select("id, is_active").eq("user_id", userId).eq("is_active", true),
      supabase.from("ai_workflows").select("id, is_active").eq("user_id", userId).eq("is_active", true),
      supabase
        .from("ai_workflow_runs")
        .select("id, status, created_at")
        .eq("user_id", userId)
        .gte("created_at", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()),
      supabase.from("assets").select("id, current_value, status, esg_metrics").eq("user_id", userId),
      supabase
        .from("ai_analysis_results")
        .select("id, created_at")
        .eq("user_id", userId)
        .gte("created_at", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()),
      supabase.from("data_embeddings").select("id, created_at").eq("user_id", userId),
      supabase
        .from("ai_request_logs")
        .select("id, status, response_time_ms, tokens_used, created_at")
        .eq("user_id", userId)
        .gte("created_at", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()),
      supabase.from("asset_intelligence_learning").select("id, success_score, quality_rating").eq("user_id", userId),
      supabase
        .from("iot_sensor_data")
        .select("iot_sensor_id")
        .in(
          "asset_id",
          (await supabase.from("assets").select("id").eq("user_id", userId)).data?.map((a) => a.id) || [],
        ),
    ])

    // Calculate metrics
    const totalAgents = agentsResult.data?.length || 0
    const activeWorkflows = workflowsResult.data?.length || 0
    const recentRuns = workflowRunsResult.data || []
    const assets = assetsResult.data || []
    const recentAnalysis = analysisResult.data || []
    const embeddings = embeddingsResult.data || []
    const requestLogs = requestLogsResult.data || []
    const learningData = learningResult.data || []

    const uniqueSensorIds = new Set((iotSensorResult.data || []).map((sensor) => sensor.iot_sensor_id).filter(Boolean))
    const iotSensorCount = uniqueSensorIds.size

    const successfulRuns = recentRuns.filter((run) => run.status === "completed").length
    const totalRuns = recentRuns.length
    const successRate = totalRuns > 0 ? (successfulRuns / totalRuns) * 100 : 0

    const successfulRequests = requestLogs.filter((log) => log.status === "success")
    const avgResponseTime =
      successfulRequests.length > 0
        ? successfulRequests.reduce((sum, log) => sum + (log.response_time_ms || 0), 0) / successfulRequests.length
        : 245

    const totalTokens = requestLogs.reduce((sum, log) => sum + (log.tokens_used || 0), 0)
    const costSavings = Math.round((totalTokens / 1000) * 0.002 * 100)

    const totalAssets = assets.length + iotSensorCount
    const totalAssetValue = assets.reduce((sum, asset) => sum + (asset.current_value || 0), 0)

    const assetsWithEsg = assets.filter(
      (asset) => asset.esg_metrics && typeof asset.esg_metrics === "object" && "score" in asset.esg_metrics,
    )
    const avgEsgScore =
      assetsWithEsg.length > 0
        ? assetsWithEsg.reduce((sum, asset) => sum + (asset.esg_metrics as any).score, 0) / assetsWithEsg.length
        : 0

    const activeAssets = assets.filter((asset) => asset.status === "active").length
    const avgUtilization = totalAssets > 0 ? (activeAssets / totalAssets) * 100 : 0

    const avgSuccessScore =
      learningData.length > 0
        ? learningData.reduce((sum, item) => sum + (item.success_score || 0), 0) / learningData.length
        : 0

    console.log(
      "[v0] Dashboard metrics - Total assets:",
      assets.length,
      "IoT sensors:",
      iotSensorCount,
      "Combined:",
      totalAssets,
    )

    return {
      totalAgents,
      activeWorkflows,
      totalRequests: requestLogs.length,
      successRate: Math.round(successRate * 10) / 10,
      avgResponseTime: Math.round(avgResponseTime),
      costSavings,
      totalAssets,
      assetValue: totalAssetValue,
      avgUtilization: Math.round(avgUtilization * 10) / 10,
      esgScore: Math.round(avgEsgScore * 10) / 10,
      recentAnalysis: recentAnalysis.length,
      totalEmbeddings: embeddings.length,
      recentWorkflowRuns: recentRuns.slice(0, 10),
      totalLearningRecords: learningData.length,
      avgLearningSuccessScore: Math.round(avgSuccessScore * 100),
    }
  },
})

export const getAssetInsights = (
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  userId: string,
  assetId?: string,
) => ({
  queryKey: assetId ? ["asset-insights", assetId] : ["asset-insights"],
  queryFn: async () => {
    let query = supabase
      .from("asset_intelligence_insights")
      .select("*")
      .eq("user_id", userId)
      .order("priority", { ascending: false })
      .order("created_at", { ascending: false })

    if (assetId) {
      query = query.eq("asset_id", assetId)
    }

    const { data, error } = await query

    if (error) throw new Error(error.message)
    return data
  },
})

export const getIoTSensorData = (supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>, userId: string) => ({
  queryKey: ["iot-sensor-data"],
  queryFn: async () => {
    const { data: userAssets, error: assetsError } = await supabase
      .from("assets")
      .select("iot_sensor_id")
      .eq("user_id", userId)
      .not("iot_sensor_id", "is", null)

    if (assetsError) throw new Error(assetsError.message)

    if (!userAssets || userAssets.length === 0) {
      return []
    }

    const sensorIds = userAssets.map((asset) => asset.iot_sensor_id).filter(Boolean)

    if (sensorIds.length === 0) {
      return []
    }

    const { data, error } = await supabase
      .from("iot_sensor_data")
      .select("*")
      .in("iot_sensor_id", sensorIds)
      .order("timestamp", { ascending: false })
      .limit(1000)

    if (error) throw new Error(error.message)
    return data
  },
})

export const getAIWorkflowRuns = (
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  userId: string,
  limit = 100,
) => ({
  queryKey: ["ai-workflow-runs", limit],
  queryFn: async () => {
    const { data, error } = await supabase
      .from("ai_workflow_runs")
      .select(
        `
        *,
        ai_workflows (
          id,
          name,
          description
        )
      `,
      )
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(limit)

    if (error) throw new Error(error.message)
    return data
  },
})

export const getAIRequestLogs = (
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  userId: string,
  days = 30,
) => ({
  queryKey: ["ai-request-logs", days],
  queryFn: async () => {
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)

    const { data, error } = await supabase
      .from("ai_request_logs")
      .select("*")
      .eq("user_id", userId)
      .gte("created_at", startDate.toISOString())
      .order("created_at", { ascending: false })

    if (error) throw new Error(error.message)
    return data
  },
})

export const getSystemWorkflowTemplates = (supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>) => ({
  queryKey: ["system-workflow-templates"],
  queryFn: async () => {
    const { data, error } = await supabase
      .from("system_workflow_templates")
      .select("*")
      .eq("is_active", true)
      .order("is_featured", { ascending: false })
      .order("name", { ascending: true })

    if (error) throw new Error(error.message)
    return data
  },
})

export const getAssetAnalytics = (supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>, userId: string) => ({
  queryKey: ["asset-analytics"],
  queryFn: async () => {
    try {
      const { data, error } = await supabase.from("asset_analytics").select("*").eq("user_id", userId)

      if (error) {
        console.error("[v0] Asset analytics query failed:", error)
        return []
      }
      return data || []
    } catch (err) {
      console.error("[v0] Asset analytics query failed:", err)
      return []
    }
  },
})

export const getAssetIntelligenceLearning = (
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  userId: string,
  limit = 100,
) => ({
  queryKey: ["asset-intelligence-learning", limit],
  queryFn: async () => {
    const { data, error } = await supabase
      .from("asset_intelligence_learning")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(limit)

    if (error) throw new Error(error.message)
    return data
  },
})

export const getAIRequestVolumeData = (
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  userId: string,
  days = 30,
) => ({
  queryKey: ["ai-request-volume", days],
  queryFn: async () => {
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)

    const { data, error } = await supabase
      .from("ai_request_logs")
      .select("created_at, status")
      .eq("user_id", userId)
      .gte("created_at", startDate.toISOString())
      .order("created_at", { ascending: true })

    if (error) throw new Error(error.message)

    const volumeMap = new Map<string, { total: number; successful: number; failed: number }>()

    data.forEach((log) => {
      const date = new Date(log.created_at).toISOString().split("T")[0]
      const existing = volumeMap.get(date) || { total: 0, successful: 0, failed: 0 }

      existing.total += 1
      if (log.status === "success") {
        existing.successful += 1
      } else {
        existing.failed += 1
      }

      volumeMap.set(date, existing)
    })

    return Array.from(volumeMap.entries())
      .map(([date, stats]) => ({
        date,
        total: stats.total,
        successful: stats.successful,
        failed: stats.failed,
      }))
      .sort((a, b) => a.date.localeCompare(b.date))
  },
})

// ============================================================================
// AETHERNET QUERIES
// ============================================================================

export const getAetherNetConnections = (
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  userId: string,
) => ({
  queryKey: ["aethernet-connections"],
  queryFn: async () => {
    const { data, error } = await supabase
      .from("aethernet_connections")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })

    if (error) throw new Error(error.message)
    return data || []
  },
})

export const getAetherNetMessages = (
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  userId: string,
  limit = 100,
) => ({
  queryKey: ["aethernet-messages", limit],
  queryFn: async () => {
    const { data, error } = await supabase
      .from("aethernet_messages")
      .select(`
        *,
        aethernet_connections (
          connection_name,
          aethernet_address
        )
      `)
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(limit)

    if (error) throw new Error(error.message)
    return data || []
  },
})

export const getAetherNetDeliveryLogs = (
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  userId: string,
  days = 7,
) => ({
  queryKey: ["aethernet-delivery-logs", days],
  queryFn: async () => {
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)

    // Get user's connection IDs first
    const { data: connections } = await supabase
      .from("aethernet_connections")
      .select("id")
      .eq("user_id", userId)

    if (!connections || connections.length === 0) return []

    const connectionIds = connections.map(c => c.id)

    const { data, error } = await supabase
      .from("aethernet_delivery_logs")
      .select("*")
      .in("recipient_id", connectionIds)
      .gte("created_at", startDate.toISOString())
      .order("created_at", { ascending: false })

    if (error) throw new Error(error.message)
    return data || []
  },
})

export const getAetherNetMetrics = (
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  userId: string,
) => ({
  queryKey: ["aethernet-metrics"],
  queryFn: async () => {
    const { data: connections, error: connError } = await supabase
      .from("aethernet_connections")
      .select("id, connection_status, messages_sent, messages_received, bandwidth_used, peer_count")
      .eq("user_id", userId)

    if (connError) throw new Error(connError.message)

    const totalConnections = connections?.length || 0
    const activeConnections = connections?.filter(c => c.connection_status === "connected").length || 0
    const totalMessagesSent = connections?.reduce((sum, c) => sum + (c.messages_sent || 0), 0) || 0
    const totalMessagesReceived = connections?.reduce((sum, c) => sum + (c.messages_received || 0), 0) || 0
    const totalBandwidth = connections?.reduce((sum, c) => sum + (c.bandwidth_used || 0), 0) || 0
    const totalPeers = connections?.reduce((sum, c) => sum + (c.peer_count || 0), 0) || 0

    return {
      totalConnections,
      activeConnections,
      totalMessagesSent,
      totalMessagesReceived,
      totalBandwidth,
      totalPeers,
    }
  },
})

// ============================================================================
// TOKENIZATION QUERIES
// ============================================================================

export const getTokenizedAssets = (
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  userId: string,
) => ({
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
          current_value
        )
      `)
      .eq("user_id", userId)
      .order("created_at", { ascending: false })

    if (error) throw new Error(error.message)
    return data || []
  },
})

export const getFractionalizationPools = (
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  userId: string,
) => ({
  queryKey: ["fractionalization-pools"],
  queryFn: async () => {
    const { data, error } = await supabase
      .from("fractionalization_pools")
      .select(`
        *,
        asset_tokens (
          token_symbol,
          token_name,
          blockchain_network
        )
      `)
      .eq("user_id", userId)
      .order("created_at", { ascending: false })

    if (error) throw new Error(error.message)
    return data || []
  },
})

export const getTokenTransactions = (
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  userId: string,
  limit = 100,
) => ({
  queryKey: ["token-transactions", limit],
  queryFn: async () => {
    const { data, error } = await supabase
      .from("token_transactions")
      .select(`
        *,
        asset_tokens (
          token_symbol,
          token_name
        )
      `)
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(limit)

    if (error) throw new Error(error.message)
    return data || []
  },
})

export const getTokenizationMetrics = (
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  userId: string,
) => ({
  queryKey: ["tokenization-metrics"],
  queryFn: async () => {
    const [tokensResult, poolsResult, transactionsResult] = await Promise.all([
      supabase.from("asset_tokens").select("id, total_supply, current_price").eq("user_id", userId),
      supabase.from("fractionalization_pools").select("id, total_value_locked, participant_count").eq("user_id", userId),
      supabase.from("token_transactions").select("id, amount, transaction_type").eq("user_id", userId),
    ])

    const tokens = tokensResult.data || []
    const pools = poolsResult.data || []
    const transactions = transactionsResult.data || []

    const totalTokenizedValue = tokens.reduce((sum, t) => sum + ((t.total_supply || 0) * (t.current_price || 0)), 0)
    const totalValueLocked = pools.reduce((sum, p) => sum + (p.total_value_locked || 0), 0)
    const totalParticipants = pools.reduce((sum, p) => sum + (p.participant_count || 0), 0)

    return {
      totalTokens: tokens.length,
      totalPools: pools.length,
      totalTransactions: transactions.length,
      totalTokenizedValue,
      totalValueLocked,
      totalParticipants,
    }
  },
})

// ============================================================================
// VOICE AGENT QUERIES
// ============================================================================

export const getVoiceExecutionLogs = (
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  userId: string,
  limit = 100,
) => ({
  queryKey: ["voice-execution-logs", limit],
  queryFn: async () => {
    const { data, error } = await supabase
      .from("voice_execution_logs")
      .select(`
        *,
        ai_agents (
          id,
          name,
          description
        )
      `)
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(limit)

    if (error) throw new Error(error.message)
    return data || []
  },
})

export const getVoiceContextSnapshots = (
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  userId: string,
  limit = 50,
) => ({
  queryKey: ["voice-context-snapshots", limit],
  queryFn: async () => {
    const { data, error } = await supabase
      .from("voice_context_snapshots")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(limit)

    if (error) throw new Error(error.message)
    return data || []
  },
})

export const getVoiceAgentMetrics = (
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  userId: string,
  days = 30,
) => ({
  queryKey: ["voice-agent-metrics", days],
  queryFn: async () => {
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)

    const { data, error } = await supabase
      .from("voice_execution_logs")
      .select("id, status, duration_ms, tokens_used, created_at")
      .eq("user_id", userId)
      .gte("created_at", startDate.toISOString())

    if (error) throw new Error(error.message)

    const logs = data || []
    const totalExecutions = logs.length
    const successfulExecutions = logs.filter(l => l.status === "completed").length
    const successRate = totalExecutions > 0 ? (successfulExecutions / totalExecutions) * 100 : 0
    const totalDuration = logs.reduce((sum, l) => sum + (l.duration_ms || 0), 0)
    const avgDuration = totalExecutions > 0 ? totalDuration / totalExecutions : 0
    const totalTokens = logs.reduce((sum, l) => sum + (l.tokens_used || 0), 0)

    return {
      totalExecutions,
      successfulExecutions,
      successRate: Math.round(successRate * 10) / 10,
      avgDurationMs: Math.round(avgDuration),
      totalTokensUsed: totalTokens,
    }
  },
})

// ============================================================================
// A2A PROTOCOL QUERIES (Agent2Agent Interoperability)
// ============================================================================

export const getA2AAgentCards = (
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  userId: string,
) => ({
  queryKey: ["a2a-agent-cards"],
  queryFn: async () => {
    const { data, error } = await supabase
      .from("a2a_agent_cards")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })

    if (error) throw new Error(error.message)
    return data || []
  },
})

export const getA2ATasks = (
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  userId: string,
  limit = 100,
) => ({
  queryKey: ["a2a-tasks", limit],
  queryFn: async () => {
    const { data, error } = await supabase
      .from("a2a_tasks")
      .select(`
        *,
        a2a_agent_cards (
          agent_id,
          name,
          description
        )
      `)
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(limit)

    if (error) throw new Error(error.message)
    return data || []
  },
})

export const getA2AMessages = (
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  userId: string,
  taskId?: string,
  limit = 100,
) => ({
  queryKey: taskId ? ["a2a-messages", taskId, limit] : ["a2a-messages", limit],
  queryFn: async () => {
    let query = supabase
      .from("a2a_messages")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(limit)

    if (taskId) {
      query = query.eq("task_id", taskId)
    }

    const { data, error } = await query

    if (error) throw new Error(error.message)
    return data || []
  },
})
