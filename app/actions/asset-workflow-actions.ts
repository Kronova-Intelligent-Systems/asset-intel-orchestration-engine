"use server"

import { z } from "zod"
import { AssetWorkflowOrchestrator } from "@/lib/workflows/asset-workflow-orchestrator"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"

function getAssetWorkflowOrchestrator() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseKey = process.env.SUPABASE_SERVIC_ROLE_KEY!

  if (!supabaseUrl || !supabaseKey) {
    throw new Error("Missing required Supabase configuration")
  }

  return new AssetWorkflowOrchestrator(supabaseUrl, supabaseKey)
}

const CreateAssetWorkflowSchema = z.object({
  name: z.string().min(1, "Workflow name is required"),
  description: z.string().min(1, "Description is required"),
  category: z.enum(["maintenance", "optimization", "compliance", "analytics", "emergency"]),
  steps: z.array(
    z.object({
      id: z.string(),
      type: z.string(),
      name: z.string(),
      description: z.string().optional(),
      config: z.record(z.string(), z.any()),
      next_steps: z.array(z.string()),
      agent_decision_point: z
        .object({
          decision_agent_id: z.string(),
          decision_criteria: z.array(z.string()),
          fallback_action: z.enum(["continue", "pause", "abort", "retry"]),
          max_decision_time_ms: z.number(),
        })
        .optional(),
      adaptive_parameters: z
        .object({
          learning_enabled: z.boolean(),
          performance_metrics: z.array(z.string()),
          optimization_target: z.enum(["speed", "accuracy", "cost", "quality"]),
        })
        .optional(),
    }),
  ),
  triggers: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      description: z.string(),
      trigger_type: z.enum(["insight_generated", "threshold_exceeded", "schedule", "manual", "agent_recommendation"]),
      conditions: z.record(z.string(), z.any()),
      auto_execute: z.boolean(),
      requires_approval: z.boolean(),
    }),
  ),
  success_criteria: z.array(z.record(z.string(), z.any())),
  asset_context: z.record(z.string(), z.any()).optional(),
})

const ExecuteWorkflowSchema = z.object({
  workflowId: z.string(),
  input: z.record(z.string(), z.any()).optional(),
  options: z
    .object({
      autonomous_mode: z.boolean().optional(),
      learning_enabled: z.boolean().optional(),
      max_execution_time: z.number().optional(),
      approval_required: z.boolean().optional(),
    })
    .optional(),
})

export async function createAssetWorkflowTemplate(formData: FormData) {
  try {
    const supabase = await createServerSupabaseClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return { success: false, error: "Authentication required" }
    }

    const rawData = {
      name: formData.get("name"),
      description: formData.get("description"),
      category: formData.get("category"),
      steps: JSON.parse(formData.get("steps") as string),
      triggers: JSON.parse(formData.get("triggers") as string),
      success_criteria: JSON.parse(formData.get("success_criteria") as string),
      asset_context: formData.get("asset_context") ? JSON.parse(formData.get("asset_context") as string) : null,
    }

    const validatedData = CreateAssetWorkflowSchema.parse(rawData)

    const orchestrator = getAssetWorkflowOrchestrator()
    const workflow = await orchestrator.createAssetWorkflowTemplate({
      ...validatedData,
      user_id: user.id,
      metadata: {
        asset_context: rawData.asset_context,
      },
    })

    revalidatePath("/ai-suite/asset-intelligence")

    return {
      success: true,
      data: workflow,
      message: "Asset workflow template created successfully",
    }
  } catch (error) {
    console.error("Create asset workflow error:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to create workflow template",
    }
  }
}

export async function executeAssetWorkflow(formData: FormData) {
  try {
    const supabase = await createServerSupabaseClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return { success: false, error: "Authentication required" }
    }

    const rawData = {
      workflowId: formData.get("workflowId"),
      input: JSON.parse((formData.get("input") as string) || "{}"),
      options: JSON.parse((formData.get("options") as string) || "{}"),
    }

    const validatedData = ExecuteWorkflowSchema.parse(rawData)

    const orchestrator = getAssetWorkflowOrchestrator()
    const result = await orchestrator.executeAgenticWorkflow(
      validatedData.workflowId,
      user.id,
      validatedData.input,
      validatedData.options,
    )

    revalidatePath("/ai-suite/asset-intelligence")

    return {
      success: true,
      data: result,
      message: "Workflow executed successfully",
    }
  } catch (error) {
    console.error("Execute workflow error:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to execute workflow",
    }
  }
}

export async function getActiveWorkflows() {
  try {
    const supabase = await createServerSupabaseClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return { success: false, error: "Authentication required" }
    }

    const { data: workflows, error } = await supabase
      .from("ai_workflows")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })

    if (error) {
      console.error("Get workflows error:", error)
      return {
        success: false,
        error: error.message || "Failed to fetch workflows",
      }
    }

    // Ensure all workflow fields are properly typed and handle null values
    const processedWorkflows = (workflows || []).map((workflow) => ({
      ...workflow,
      name: String(workflow.name || ""),
      description: String(workflow.description || ""),
      category: String(workflow.category || ""),
      steps: workflow.steps || [],
      metadata: workflow.metadata || {},
    }))

    return {
      success: true,
      data: processedWorkflows,
    }
  } catch (error) {
    console.error("Get workflows error:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to fetch workflows",
    }
  }
}

export async function registerWorkflowTrigger(formData: FormData) {
  try {
    const supabase = await createServerSupabaseClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return { success: false, error: "Authentication required" }
    }

    const triggerData = JSON.parse(formData.get("trigger") as string)

    const orchestrator = getAssetWorkflowOrchestrator()
    const trigger = await orchestrator.registerWorkflowTrigger(triggerData)

    revalidatePath("/ai-suite/asset-intelligence")

    return {
      success: true,
      data: trigger,
      message: "Workflow trigger registered successfully",
    }
  } catch (error) {
    console.error("Register trigger error:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to register trigger",
    }
  }
}
