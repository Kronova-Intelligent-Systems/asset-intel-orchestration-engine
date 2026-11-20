"use server"

import { createServerSupabaseClient } from "@/lib/supabase/server"
import { z } from "zod"

const logAgentRunSchema = z.object({
  agentId: z.string(),
  agentName: z.string(),
  modelId: z.string().optional(),
  modelName: z.string().optional(),
  prompt: z.string(),
  response: z.string(),
  tokensUsed: z.number().default(0),
  promptTokens: z.number().default(0),
  completionTokens: z.number().default(0),
  executionTimeMs: z.number().default(0),
  iterations: z.number().default(1),
  toolCalls: z.array(z.any()).default([]),
  contextData: z.record(z.string(), z.any()).optional(),
  status: z.enum(["completed", "failed", "cancelled"]).default("completed"),
  errorMessage: z.string().optional(),
})

export async function logAgentExecution(data: z.infer<typeof logAgentRunSchema>) {
  try {
    const validated = logAgentRunSchema.parse(data)
    const supabase = await createServerSupabaseClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return { success: false, error: "Not authenticated" }
    }

    let modelId = validated.modelId
    if (!modelId && validated.agentId) {
      const { data: agent } = await supabase.from("ai_agents").select("model_id").eq("id", validated.agentId).single()

      if (agent?.model_id) {
        modelId = agent.model_id
      }
    }

    const executionTimestamp = new Date().toISOString()

    // Log to ai_agent_runs
    const { data: agentRun, error: agentRunError } = await supabase
      .from("ai_agent_runs")
      .insert({
        user_id: user.id,
        agent_id: validated.agentId,
        status: validated.status,
        error_message: validated.errorMessage,
        execution_time_ms: validated.executionTimeMs,
        started_at: executionTimestamp,
        completed_at: executionTimestamp,
        input_data: {
          agent_name: validated.agentName,
          model_name: validated.modelName,
          model_id: modelId,
          prompt: validated.prompt,
          prompt_tokens: validated.promptTokens,
          iterations: validated.iterations,
          tool_calls: validated.toolCalls,
          context_data: validated.contextData || {},
          executed_at: executionTimestamp,
        },
        output_data: {
          response: validated.response,
          tokens_used: validated.tokensUsed,
          completion_tokens: validated.completionTokens,
        },
      })
      .select()
      .single()

    if (agentRunError) {
      console.error("[v0] Error logging to ai_agent_runs:", agentRunError.message)
      return { success: false, error: agentRunError.message }
    }

    // The valid_status constraint expects: "pending", "completed", "failed"
    const requestLogStatus = validated.status === "completed" ? "completed" : "failed"

    const { error: requestLogError } = await supabase.from("ai_request_logs").insert({
      user_id: user.id,
      agent_id: validated.agentId,
      model_id: modelId || null,
      request_type: "agent_execution",
      input_length: validated.promptTokens,
      output_length: validated.completionTokens,
      tokens_used: validated.tokensUsed,
      cost_usd: (validated.tokensUsed / 1000) * 0.002,
      response_time_ms: validated.executionTimeMs,
      status: requestLogStatus,
      error_message: validated.errorMessage,
      completed_at: executionTimestamp,
      metadata: {
        agent_name: validated.agentName,
        model_name: validated.modelName,
        iterations: validated.iterations,
        tool_calls_count: validated.toolCalls.length,
      },
    })

    if (requestLogError) {
      // Log but don't fail - ai_agent_runs is the primary log
      console.error("[v0] Error logging to ai_request_logs:", requestLogError.message)
    }

    return { success: true, data: agentRun }
  } catch (error) {
    console.error("[v0] Error in logAgentExecution:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to log agent execution",
    }
  }
}

export async function getAgentExecutionHistory(agentId: string, limit = 50) {
  try {
    const supabase = await createServerSupabaseClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return { success: false, error: "Not authenticated" }
    }

    const { data, error } = await supabase
      .from("ai_agent_runs")
      .select("*")
      .eq("user_id", user.id)
      .eq("agent_id", agentId)
      .order("created_at", { ascending: false })
      .limit(limit)

    if (error) {
      return { success: false, error: error.message }
    }

    return { success: true, data }
  } catch (error) {
    console.error("[v0] Error in getAgentExecutionHistory:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to get execution history",
    }
  }
}
