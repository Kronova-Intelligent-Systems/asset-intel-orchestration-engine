"use server"

import { createServerSupabaseClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import * as z from "zod"
import { getAssetAgentTemplateById } from "@/lib/ai/asset-agent-templates"

// Schema for creating asset agents
const createAssetAgentSchema = z.object({
  template_id: z.string().min(1, "Template ID is required"),
  name: z.string().min(1, "Agent name is required").max(255),
  description: z.string().optional(),
  model_id: z.string().uuid("Valid AI model is required"),
  parameters: z.object({
    temperature: z.number().min(0).max(1),
    max_tokens: z.number().int().min(100).max(4000),
  }),
  target_assets: z.array(z.string().uuid()).min(1, "At least one target asset is required"),
  auto_insights: z.boolean().default(true),
  notification_threshold: z.enum(["low", "medium", "high"]).default("medium"),
  custom_instructions: z.string().optional(),
})

// Schema for updating asset agents
const updateAssetAgentSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(255).optional(),
  description: z.string().optional(),
  system_prompt: z.string().optional(),
  model_id: z.string().uuid().optional(),
  tools: z.array(z.string()).optional(),
  parameters: z
    .object({
      temperature: z.number().min(0).max(1),
      max_tokens: z.number().int().min(100).max(4000),
    })
    .optional(),
  temperature: z.number().min(0).max(1).optional(),
  max_tokens: z.number().int().min(100).max(4000).optional(),
  target_assets: z.array(z.string().uuid()).optional(),
  auto_insights: z.boolean().optional(),
  notification_threshold: z.enum(["low", "medium", "high"]).optional(),
  custom_instructions: z.string().optional(),
  is_active: z.boolean().optional(),
})

// Create asset intelligence agent
export async function createAssetAgent(formData: z.infer<typeof createAssetAgentSchema>) {
  const supabase = await createServerSupabaseClient()

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return { success: false, error: "User not authenticated" }
    }

    const validatedData = createAssetAgentSchema.parse(formData)

    // Get the template to validate it exists
    const template = getAssetAgentTemplateById(validatedData.template_id)
    if (!template) {
      return { success: false, error: "Invalid template ID" }
    }

    const { data: modelData, error: modelError } = await supabase
      .from("ai_models")
      .select("id, name, provider")
      .eq("id", validatedData.model_id)
      .eq("is_active", true)
      .single()

    if (modelError || !modelData) {
      return { success: false, error: "Invalid or inactive AI model selected" }
    }

    // Verify all target assets belong to user
    const { data: assets, error: assetsError } = await supabase
      .from("assets")
      .select("id")
      .in("id", validatedData.target_assets)
      .eq("user_id", user.id)

    if (assetsError || !assets || assets.length !== validatedData.target_assets.length) {
      return { success: false, error: "Some target assets not found or access denied" }
    }

    // Create the AI agent record
    const { data: agentData, error: agentError } = await supabase
      .from("ai_agents")
      .insert({
        name: validatedData.name,
        description: validatedData.description || template.description,
        system_prompt:
          template.systemPrompt +
          (validatedData.custom_instructions ? `\n\nCustom Instructions: ${validatedData.custom_instructions}` : ""),
        parameters: validatedData.parameters,
        tools: template.tools, // Already using string array from template
        model_id: validatedData.model_id,
        user_id: user.id,
        is_active: true,
      })
      .select()
      .single()

    if (agentError) {
      console.error("Error creating AI agent:", agentError)
      return { success: false, error: agentError.message }
    }

    // Create asset agent configuration
    const { data: configData, error: configError } = await supabase
      .from("asset_agent_configs")
      .insert({
        agent_id: agentData.id,
        template_id: validatedData.template_id,
        target_assets: validatedData.target_assets,
        auto_insights: validatedData.auto_insights,
        notification_threshold: validatedData.notification_threshold,
        user_id: user.id,
      })
      .select()
      .single()

    if (configError) {
      console.error("Error creating asset agent config:", configError)
      // Clean up the agent record
      await supabase.from("ai_agents").delete().eq("id", agentData.id)
      return { success: false, error: configError.message }
    }

    revalidatePath("/ai-suite/asset-intelligence")
    return {
      success: true,
      data: {
        agent: agentData,
        config: configData,
      },
    }
  } catch (error) {
    console.error("Error in createAssetAgent:", error)
    if (error instanceof z.ZodError) {
      return { success: false, error: error.issues[0].message }
    }
    return { success: false, error: "An unexpected error occurred" }
  }
}

// Update asset intelligence agent
export async function updateAssetAgent(formData: z.infer<typeof updateAssetAgentSchema>) {
  const supabase = await createServerSupabaseClient()

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return { success: false, error: "User not authenticated" }
    }

    const validatedData = updateAssetAgentSchema.parse(formData)

    // Verify agent ownership
    const { data: existingAgent, error: fetchError } = await supabase
      .from("ai_agents")
      .select("id")
      .eq("id", validatedData.id)
      .eq("user_id", user.id)
      .single()

    if (fetchError || !existingAgent) {
      return { success: false, error: "Agent not found or access denied" }
    }

    // If target_assets is being updated, verify ownership
    if (validatedData.target_assets) {
      const { data: assets, error: assetsError } = await supabase
        .from("assets")
        .select("id")
        .in("id", validatedData.target_assets)
        .eq("user_id", user.id)

      if (assetsError || !assets || assets.length !== validatedData.target_assets.length) {
        return { success: false, error: "Some target assets not found or access denied" }
      }
    }

    // Update the AI agent
    const agentUpdates: any = {}
    if (validatedData.name) agentUpdates.name = validatedData.name
    if (validatedData.description !== undefined) agentUpdates.description = validatedData.description
    if (validatedData.system_prompt) agentUpdates.system_prompt = validatedData.system_prompt
    if (validatedData.model_id) agentUpdates.model_id = validatedData.model_id
    if (validatedData.tools) agentUpdates.tools = validatedData.tools

    if (validatedData.parameters) {
      agentUpdates.temperature = validatedData.parameters.temperature
      agentUpdates.max_tokens = validatedData.parameters.max_tokens
    } else {
      if (validatedData.temperature !== undefined) agentUpdates.temperature = validatedData.temperature
      if (validatedData.max_tokens !== undefined) agentUpdates.max_tokens = validatedData.max_tokens
    }

    if (validatedData.is_active !== undefined) agentUpdates.is_active = validatedData.is_active

    if (Object.keys(agentUpdates).length > 0) {
      const { error: agentError } = await supabase.from("ai_agents").update(agentUpdates).eq("id", validatedData.id)

      if (agentError) {
        console.error("Error updating AI agent:", agentError)
        return { success: false, error: agentError.message }
      }
    }

    // Update asset agent configuration
    const configUpdates: any = {}
    if (validatedData.target_assets) configUpdates.target_assets = validatedData.target_assets
    if (validatedData.auto_insights !== undefined) configUpdates.auto_insights = validatedData.auto_insights
    if (validatedData.notification_threshold)
      configUpdates.notification_threshold = validatedData.notification_threshold

    if (Object.keys(configUpdates).length > 0) {
      const { error: configError } = await supabase
        .from("asset_agent_configs")
        .update(configUpdates)
        .eq("agent_id", validatedData.id)

      if (configError) {
        console.error("Error updating asset agent config:", configError)
        return { success: false, error: configError.message }
      }
    }

    revalidatePath("/ai-suite/asset-intelligence")
    return { success: true }
  } catch (error) {
    console.error("Error in updateAssetAgent:", error)
    if (error instanceof z.ZodError) {
      return { success: false, error: error.issues[0].message }
    }
    return { success: false, error: "An unexpected error occurred" }
  }
}

// Get asset agents for a user
export async function getAssetAgents(userId: string) {
  const supabase = await createServerSupabaseClient()

  try {
    const { data, error } = await supabase
      .from("ai_agents")
      .select(`
        *,
        asset_agent_configs (
          template_id,
          target_assets,
          auto_insights,
          notification_threshold
        )
      `)
      .eq("user_id", userId)
      .not("asset_agent_configs", "is", null)
      .order("created_at", { ascending: false })

    if (error) {
      console.error("Error fetching asset agents:", error)
      return { success: false, error: error.message }
    }

    return { success: true, data: data || [] }
  } catch (error) {
    console.error("Error in getAssetAgents:", error)
    return { success: false, error: "An unexpected error occurred" }
  }
}

// Delete asset agent
export async function deleteAssetAgent(agentId: string) {
  const supabase = await createServerSupabaseClient()

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return { success: false, error: "User not authenticated" }
    }

    // Verify agent ownership
    const { data: existingAgent, error: fetchError } = await supabase
      .from("ai_agents")
      .select("id")
      .eq("id", agentId)
      .eq("user_id", user.id)
      .single()

    if (fetchError || !existingAgent) {
      return { success: false, error: "Agent not found or access denied" }
    }

    // Delete the agent (cascade will handle config)
    const { error } = await supabase.from("ai_agents").delete().eq("id", agentId)

    if (error) {
      console.error("Error deleting asset agent:", error)
      return { success: false, error: error.message }
    }

    revalidatePath("/ai-suite/asset-intelligence")
    return { success: true }
  } catch (error) {
    console.error("Error in deleteAssetAgent:", error)
    return { success: false, error: "An unexpected error occurred" }
  }
}

// Execute agent analysis on specific assets
export async function executeAssetAgentAnalysis(agentId: string, assetIds?: string[]) {
  const supabase = await createServerSupabaseClient()

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return { success: false, error: "User not authenticated" }
    }

    // Get agent and config
    const { data: agentData, error: agentError } = await supabase
      .from("ai_agents")
      .select(`
        *,
        asset_agent_configs (
          template_id,
          target_assets,
          auto_insights,
          notification_threshold
        )
      `)
      .eq("id", agentId)
      .eq("user_id", user.id)
      .single()

    if (agentError || !agentData) {
      return { success: false, error: "Agent not found or access denied" }
    }

    const config = agentData.asset_agent_configs[0]
    const targetAssets = assetIds || config.target_assets

    // This would integrate with the AI system to actually run the analysis
    // For now, we'll create a placeholder result
    const analysisResult = {
      agent_id: agentId,
      assets_analyzed: targetAssets.length,
      insights_generated: Math.floor(Math.random() * 5) + 1,
      execution_time: Date.now(),
    }

    return { success: true, data: analysisResult }
  } catch (error) {
    console.error("Error in executeAssetAgentAnalysis:", error)
    return { success: false, error: "An unexpected error occurred" }
  }
}
