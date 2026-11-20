import { z } from "zod"

export const createAgentSchema = z.object({
  name: z.string().min(3).max(255),
  description: z.string().optional(),
  system_prompt: z.string().min(3),
  model_id: z.string().uuid(),
  temperature: z.number().min(0).max(1),
  max_tokens: z.number().min(100).max(4000),
})

export const updateAgentSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(3).max(255),
  description: z.string().optional(),
  system_prompt: z.string().min(3),
  model_id: z.string().uuid(),
  temperature: z.number().min(0).max(1),
  max_tokens: z.number().min(100).max(4000),
})

export type CreateAIAgent = z.infer<typeof createAgentSchema>
export type UpdateAIAgent = z.infer<typeof updateAgentSchema>

// Zod schema for the ai_workflows table
export const workflowStepSchema = z.object({
  id: z.string().min(1),
  type: z.enum(["agent", "embedding", "supply_chain", "code_generation", "data_analysis", "custom"]),
  name: z.string().min(1),
  description: z.string().optional(),
  config: z.record(z.string(), z.any()),
  next_steps: z.array(z.string()),
  condition: z
    .object({
      field: z.string(),
      operator: z.enum(["==", "!=", ">", "<", ">=", "<=", "contains", "not_contains"]),
      value: z.any(),
    })
    .optional(),
})

export type WorkflowStep = z.infer<typeof workflowStepSchema>

export const aiWorkflowSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1).max(255),
  description: z.string().optional().nullable(),
  steps: z.array(workflowStepSchema),
  trigger_type: z.string().optional().nullable(),
  trigger_config: z.record(z.string(), z.any()).optional().default({}),
  is_active: z.boolean().optional().default(true),
  user_id: z.string().uuid(),
  created_at: z.string().datetime().optional(),
  updated_at: z.string().datetime().optional(),
})

export type AIWorkflow = z.infer<typeof aiWorkflowSchema>

// Zod schema for the developer_tools table
export const developerToolSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1).max(255),
  tool_type: z.string().min(1).max(100),
  configuration: z.record(z.string(), z.any()),
  description: z.string().nullable().optional(),
  is_active: z.boolean().default(true),
  user_id: z.string().uuid(),
  created_at: z.string().datetime().optional(),
  updated_at: z.string().datetime().optional(),
})

export type DeveloperTool = z.infer<typeof developerToolSchema>

// Zod schema for the shipping table
export const shippingSchema = z.object({
  id: z.string().uuid().optional(),
  tracking_number: z.string().min(1).max(255),
  origin_address: z.record(z.string(), z.any()),
  destination_address: z.record(z.string(), z.any()),
  package_ids: z.array(z.string()).default([]),
  carrier: z.string().nullable().optional(),
  shipping_date: z.string().datetime().nullable().optional(),
  estimated_delivery: z.string().datetime().nullable().optional(),
  actual_delivery: z.string().datetime().nullable().optional(),
  status: z
    .enum(["created", "pending", "in_transit", "delivered", "delayed", "cancelled", "exception"])
    .default("pending"),
  cost: z.number().nullable().optional(),
  weight: z.number().nullable().optional(),
  dimensions: z.record(z.string(), z.any()).nullable().optional(),
  metadata: z.record(z.string(), z.any()).default({}),
  current_location: z.record(z.string(), z.any()).nullable().optional(),
  transit_events: z.array(z.record(z.string(), z.any())).default([]),
  created_at: z.string().datetime().optional(),
  updated_at: z.string().datetime().optional(),
})

export type Shipping = z.infer<typeof shippingSchema>

// Zod schema for the package_utilization view
export const packageUtilizationSchema = z.object({
  id: z.string().uuid().optional(),
  package_id: z.string().min(1).max(255).optional(),
  name: z.string().min(1).max(255).optional(),
  reuse_count: z.number().optional(),
  status: z.string().optional(),
  shipment_count: z.number().optional(),
  last_used_date: z.string().datetime().nullable().optional(),
  created_at: z.string().datetime().optional(),
  days_since_creation: z.number().optional(),
  reuses_per_day: z.number().optional(),
})

export type PackageUtilization = z.infer<typeof packageUtilizationSchema>

// Zod schema for the shipping_analytics view
export const shippingAnalyticsSchema = z.object({
  shipping_day: z.string().datetime().optional(),
  total_shipments: z.number().optional(),
  avg_estimated_delivery_days: z.number().optional(),
  avg_actual_delivery_days: z.number().optional(),
  total_cost: z.number().optional(),
  avg_cost: z.number().optional(),
  total_weight: z.number().optional(),
  avg_weight: z.number().optional(),
  delivered_count: z.number().optional(),
  in_transit_count: z.number().optional(),
  delayed_count: z.number().optional(),
})

export type ShippingAnalytics = z.infer<typeof shippingAnalyticsSchema>

// Schema for ai_models table
export const aiModelSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(255),
  provider: z.string().min(1).max(100),
  model_id: z.string().min(1).max(255),
  description: z.string().nullable(),
  capabilities: z.array(z.string()),
  parameters: z.record(z.string(), z.any()),
  cost_per_1k_tokens: z.number().nullable(),
  is_active: z.boolean().default(true),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
})

export type AIModel = z.infer<typeof aiModelSchema>

// Schema for ai_agents table
export const aiAgentSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(255),
  description: z.string().nullable(),
  system_prompt: z.string().nullable(),
  model_id: z.string().uuid(),
  user_id: z.string().uuid(),
  parameters: z.record(z.string(), z.any()),
  tools: z.array(z.any()),
  is_active: z.boolean().default(true),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
  max_tokens: z.number().optional(),
})

export type AIAgent = z.infer<typeof aiAgentSchema>

export const updateAIAgentSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(255).optional(),
  description: z.string().nullable().optional(),
  system_prompt: z.string().nullable().optional(),
  model_id: z.string().uuid().optional(),
  parameters: z.record(z.string(), z.any()).optional(),
  tools: z.array(z.any()).optional(),
  is_active: z.boolean().optional(),
  max_tokens: z.number().min(100).max(8000).nullable().optional(),
})

export type UpdateAIAgentType = z.infer<typeof updateAIAgentSchema>

export const systemAIAgentSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(255),
  description: z.string().nullable(),
  system_prompt: z.string().nullable(),
  model_id: z.string().uuid(),
  parameters: z.record(z.string(), z.any()).default({}),
  tools: z.array(z.any()).default([]),
  is_active: z.boolean().default(true),
  is_system: z.boolean().default(true),
  capabilities: z.array(z.string()).default([]),
  access_level: z.enum(["public", "restricted", "admin"]).default("public"),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
  max_tokens: z.number().min(100).max(8000).nullable().optional(),
})

export type SystemAIAgent = z.infer<typeof systemAIAgentSchema>

export const createSystemAIAgentSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().nullable().optional(),
  system_prompt: z.string().min(1),
  model_id: z.string().uuid(),
  parameters: z.record(z.string(), z.any()).default({}),
  tools: z.array(z.any()).default([]),
  is_active: z.boolean().default(true),
  capabilities: z.array(z.string()).default([]),
  access_level: z.enum(["public", "restricted", "admin"]).default("public"),
  max_tokens: z.number().min(100).max(8000).nullable().optional(),
})

export const updateSystemAIAgentSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(255).optional(),
  description: z.string().nullable().optional(),
  system_prompt: z.string().min(1).optional(),
  model_id: z.string().uuid().optional(),
  parameters: z.record(z.string(), z.any()).optional(),
  tools: z.array(z.any()).optional(),
  is_active: z.boolean().optional(),
  capabilities: z.array(z.string()).optional(),
  access_level: z.enum(["public", "restricted", "admin"]).optional(),
  max_tokens: z.number().min(100).max(8000).nullable().optional(),
})

export const deleteSystemAIAgentSchema = z.object({
  id: z.string().uuid(),
})

export const getSystemAIAgentSchema = z.object({
  id: z.string().uuid().optional(),
  access_level: z.enum(["public", "restricted", "admin"]).optional(),
  is_active: z.boolean().optional(),
})

export type CreateSystemAIAgent = z.infer<typeof createSystemAIAgentSchema>
export type UpdateSystemAIAgent = z.infer<typeof updateSystemAIAgentSchema>
export type DeleteSystemAIAgent = z.infer<typeof deleteSystemAIAgentSchema>
export type GetSystemAIAgent = z.infer<typeof getSystemAIAgentSchema>
