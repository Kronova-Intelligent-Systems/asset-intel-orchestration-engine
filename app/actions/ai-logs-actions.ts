"use server"

/**
 * Kronova AI Logs Server Actions
 * Fetches AI request logs, voice execution logs, and analysis results
 */

import { createServerSupabaseClient } from "@/lib/supabase/server"

export async function getAIRequestLogs(userId: string, limit = 100) {
  try {
    const supabase = await createServerSupabaseClient()

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
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(limit)

    if (error) throw error

    return { success: true, data: data || [] }
  } catch (error) {
    console.error("[Kronova] Error fetching AI request logs:", error)
    return { success: false, error: String(error), data: [] }
  }
}

export async function getVoiceExecutionLogs(userId: string, limit = 100) {
  try {
    const supabase = await createServerSupabaseClient()

    const { data, error } = await supabase
      .from("voice_execution_logs")
      .select(`
        *,
        ai_agents (
          name,
          description
        )
      `)
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(limit)

    if (error) throw error

    return { success: true, data: data || [] }
  } catch (error) {
    console.error("[Kronova] Error fetching voice execution logs:", error)
    return { success: false, error: String(error), data: [] }
  }
}

export async function getAIAnalysisResults(userId: string, limit = 100) {
  try {
    const supabase = await createServerSupabaseClient()

    const { data, error } = await supabase
      .from("ai_analysis_results")
      .select(`
        *,
        ai_request_logs (
          prompt,
          request_type
        ),
        ai_agents (
          name,
          description
        )
      `)
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(limit)

    if (error) throw error

    return { success: true, data: data || [] }
  } catch (error) {
    console.error("[Kronova] Error fetching AI analysis results:", error)
    return { success: false, error: String(error), data: [] }
  }
}

export async function getVoiceAnalysisResults(userId: string, limit = 100) {
  try {
    const supabase = await createServerSupabaseClient()

    const { data, error } = await supabase
      .from("voice_analysis_results")
      .select(`
        *,
        voice_execution_logs (
          transcription,
          duration_seconds
        ),
        ai_agents (
          name,
          description
        )
      `)
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(limit)

    if (error) throw error

    return { success: true, data: data || [] }
  } catch (error) {
    console.error("[Kronova] Error fetching voice analysis results:", error)
    return { success: false, error: String(error), data: [] }
  }
}

export async function getAILogsStatistics(userId: string) {
  try {
    const supabase = await createServerSupabaseClient()

    // Get counts
    const [aiRequests, voiceRequests, aiResults, voiceResults] = await Promise.all([
      supabase
        .from("ai_request_logs")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId),
      supabase
        .from("voice_execution_logs")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId),
      supabase
        .from("ai_analysis_results")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId),
      supabase
        .from("voice_analysis_results")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId),
    ])

    // Get total tokens used
    const { data: tokensData } = await supabase
      .from("ai_request_logs")
      .select("tokens_used")
      .eq("user_id", userId)

    const totalTokens = tokensData?.reduce((sum, item) => sum + (item.tokens_used || 0), 0) || 0

    // Get average execution time
    const { data: execTimeData } = await supabase
      .from("ai_agent_runs")
      .select("execution_time_ms")
      .eq("user_id", userId)
      .not("execution_time_ms", "is", null)

    const avgExecutionTime =
      execTimeData && execTimeData.length > 0
        ? execTimeData.reduce((sum, item) => sum + (item.execution_time_ms || 0), 0) / execTimeData.length
        : 0

    return {
      success: true,
      data: {
        totalAIRequests: aiRequests.count || 0,
        totalVoiceRequests: voiceRequests.count || 0,
        totalAIResults: aiResults.count || 0,
        totalVoiceResults: voiceResults.count || 0,
        totalTokensUsed: totalTokens,
        avgExecutionTimeMs: Math.round(avgExecutionTime),
      },
    }
  } catch (error) {
    console.error("[Kronova] Error fetching AI logs statistics:", error)
    return { success: false, error: String(error), data: null }
  }
}
