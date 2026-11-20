import { z } from "zod"

// Asset Type and Status Enums
export const assetTypeSchema = z.enum([
  "equipment",
  "vehicle",
  "container",
  "device",
  "infrastructure",
  "inventory",
  "digital",
  "building",
  "machinery",
  "tool",
  "component",
  "material",
  "software",
  "license",
  "intellectual_property",
])

export const assetStatusSchema = z.enum(["active", "inactive", "maintenance", "retired", "lost", "disposed", "pending"])

export const eventTypeSchema = z.enum([
  "created",
  "deployed",
  "maintenance",
  "repair",
  "moved",
  "retired",
  "lost",
  "found",
  "inspection",
  "compliance_check",
  "upgrade",
  "transfer",
  "calibration",
  "decommissioned",
])

export const eventStatusSchema = z.enum(["scheduled", "in_progress", "completed", "cancelled", "failed", "pending"])

export const insightTypeSchema = z.enum([
  "predictive_maintenance",
  "cost_optimization",
  "utilization_analysis",
  "compliance_risk",
  "esg_impact",
  "lifecycle_prediction",
  "performance_analysis",
  "anomaly_detection",
  "capacity_planning",
])

export const prioritySchema = z.enum(["low", "medium", "high", "critical", "urgent"])

export const insightStatusSchema = z.enum(["active", "acknowledged", "resolved", "dismissed", "pending", "expired"])

// Core Asset Schema
export const assetSchema = z.object({
  id: z.string().uuid().optional(),
  asset_id: z.string().min(1, "Asset ID is required"),
  name: z.string().min(1, "Asset name is required").max(255),
  description: z.string().optional().nullable(),
  asset_type: z.string().min(1, "Asset type is required"), // Use string to accept any valid type
  category: z.string().optional().nullable(),
  status: z.string().default("active"),
  location_id: z.string().optional().nullable(),
  current_location: z.record(z.string(), z.any()).optional().nullable(),
  specifications: z.record(z.string(), z.any()).optional().nullable(),
  purchase_date: z.string().optional().nullable(),
  purchase_cost: z.number().optional().nullable(),
  depreciation_rate: z.number().min(0).max(100).optional().nullable(),
  current_value: z.number().optional().nullable(),
  last_maintenance_date: z.string().optional().nullable(),
  next_maintenance_date: z.string().optional().nullable(),
  maintenance_schedule: z.record(z.string(), z.any()).optional().nullable(),
  compliance_data: z.record(z.string(), z.any()).optional().nullable(),
  esg_metrics: z.record(z.string(), z.any()).optional().nullable(),
  iot_sensor_id: z.string().optional().nullable(),
  nfc_tag_id: z.string().optional().nullable(),
  qr_code: z.string().optional().nullable(),
  operational_status: z.string().optional().nullable(),
  battery_level: z.number().optional().nullable(),
  current_task: z.record(z.string(), z.any()).optional().nullable(),
  task_queue: z.record(z.string(), z.any()).optional().nullable(),
  task_progress: z.number().optional().nullable(),
  speed: z.number().optional().nullable(),
  payload_capacity: z.number().optional().nullable(),
  sensors: z.array(z.string()).optional().nullable(),
  capabilities: z.record(z.string(), z.any()).optional().nullable(),
  workflow_settings: z.record(z.string(), z.any()).optional().nullable(),
  ai_agent_config: z.record(z.string(), z.any()).optional().nullable(),
  predictive_data: z.record(z.string(), z.any()).optional().nullable(),
  risk_score: z.number().optional().nullable(),
  error_count: z.number().optional().nullable(),
  total_runtime_hours: z.number().optional().nullable(),
  special_tools: z.array(z.string()).optional().nullable(),
  location: z.record(z.string(), z.any()).optional().nullable(),
  embedding_vector: z.string().optional().nullable(),
  metadata: z.record(z.string(), z.any()).optional().nullable(),
  user_id: z.string().uuid(),
  created_at: z.string().optional().nullable(),
  updated_at: z.string().optional().nullable(),
})

export const createAssetSchema = assetSchema.omit({
  id: true,
  created_at: true,
  updated_at: true,
})

export const updateAssetSchema = assetSchema.partial().required({ id: true })

// Asset Lifecycle Event Schema
export const assetLifecycleEventSchema = z.object({
  id: z.string().uuid().optional(),
  asset_id: z.string().uuid(),
  event_type: eventTypeSchema,
  event_status: eventStatusSchema.default("completed"),
  event_date: z
    .string()
    .datetime()
    .default(() => new Date().toISOString()),
  location: z.record(z.string(), z.any()).optional().nullable(),
  cost: z.number().positive().optional().nullable(),
  description: z.string().optional().nullable(),
  performed_by: z.string().optional().nullable(),
  documentation: z.record(z.string(), z.any()).default({}),
  ai_analysis_id: z.string().uuid().optional().nullable(),
  metadata: z.record(z.string(), z.any()).default({}),
  user_id: z.string().uuid(),
  created_at: z.string().datetime().optional(),
})

export const createAssetLifecycleEventSchema = assetLifecycleEventSchema.omit({
  id: true,
  created_at: true,
})

export const updateAssetLifecycleEventSchema = assetLifecycleEventSchema.partial().required({ id: true })

// Asset Intelligence Insight Schema
export const assetIntelligenceInsightSchema = z.object({
  id: z.string().uuid().optional(),
  asset_id: z.string().uuid(),
  insight_type: insightTypeSchema,
  confidence_score: z.number().min(0).max(1),
  insight_data: z.record(z.string(), z.any()),
  recommendations: z.array(z.record(z.string(), z.any())).default([]),
  priority: prioritySchema.default("medium"),
  status: insightStatusSchema.default("active"),
  ai_agent_id: z.string().uuid().optional().nullable(),
  workflow_run_id: z.string().uuid().optional().nullable(),
  expires_at: z.string().datetime().optional().nullable(),
  user_id: z.string().uuid(),
  created_at: z.string().datetime().optional(),
  updated_at: z.string().datetime().optional(),
})

export const createAssetIntelligenceInsightSchema = assetIntelligenceInsightSchema.omit({
  id: true,
  created_at: true,
  updated_at: true,
})

export const updateAssetIntelligenceInsightSchema = assetIntelligenceInsightSchema.partial().required({ id: true })

// Asset Workflow Schema
export const assetWorkflowSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1, "Workflow name is required").max(255),
  description: z.string().optional().nullable(),
  asset_type: assetTypeSchema.optional().nullable(),
  trigger_conditions: z.record(z.string(), z.any()),
  workflow_steps: z.record(z.string(), z.any()),
  is_active: z.boolean().default(true),
  execution_count: z.number().int().min(0).default(0),
  last_executed_at: z.string().datetime().optional().nullable(),
  user_id: z.string().uuid(),
  created_at: z.string().datetime().optional(),
  updated_at: z.string().datetime().optional(),
})

export const createAssetWorkflowSchema = assetWorkflowSchema.omit({
  id: true,
  created_at: true,
  updated_at: true,
  execution_count: true,
  last_executed_at: true,
})

export const updateAssetWorkflowSchema = assetWorkflowSchema.partial().required({ id: true })

// Search and Filter Schemas
export const assetFilterSchema = z.object({
  asset_type: assetTypeSchema.optional(),
  status: assetStatusSchema.optional(),
  category: z.string().optional(),
  has_iot: z.boolean().optional(),
  location_id: z.string().optional(),
  min_value: z.number().positive().optional(),
  max_value: z.number().positive().optional(),
  search_query: z.string().optional(),
})

export const insightFilterSchema = z.object({
  insight_type: insightTypeSchema.optional(),
  priority: prioritySchema.optional(),
  status: insightStatusSchema.optional(),
  min_confidence: z.number().min(0).max(1).optional(),
  asset_id: z.string().uuid().optional(),
})

// Bulk Operations Schemas
export const bulkAssetUpdateSchema = z.object({
  asset_ids: z.array(z.string().uuid()).min(1, "At least one asset ID is required"),
  updates: z.object({
    status: assetStatusSchema.optional(),
    category: z.string().optional(),
    location_id: z.string().optional(),
    metadata: z.record(z.string(), z.any()).optional(),
  }),
})

export const bulkInsightActionSchema = z.object({
  insight_ids: z.array(z.string().uuid()).min(1, "At least one insight ID is required"),
  action: z.enum(["acknowledge", "resolve", "dismiss"]),
})

// AI Agent Integration Schemas
export const assetAnalysisRequestSchema = z.object({
  asset_id: z.string().uuid(),
  analysis_types: z.array(z.string()).min(1, "At least one analysis type is required"),
  agent_template_id: z.string().optional(),
  custom_parameters: z.record(z.string(), z.any()).optional(),
})

export const workflowExecutionRequestSchema = z.object({
  workflow_id: z.string().uuid(),
  asset_id: z.string().uuid(),
  execution_context: z.record(z.string(), z.any()).optional(),
})

// Type exports
export type AssetType = z.infer<typeof assetTypeSchema>
export type AssetStatus = z.infer<typeof assetStatusSchema>
export type EventType = z.infer<typeof eventTypeSchema>
export type EventStatus = z.infer<typeof eventStatusSchema>
export type InsightType = z.infer<typeof insightTypeSchema>
export type Priority = z.infer<typeof prioritySchema>
export type InsightStatus = z.infer<typeof insightStatusSchema>

export type Asset = z.infer<typeof assetSchema>
export type CreateAsset = z.infer<typeof createAssetSchema>
export type UpdateAsset = z.infer<typeof updateAssetSchema>

export type AssetLifecycleEvent = z.infer<typeof assetLifecycleEventSchema>
export type CreateAssetLifecycleEvent = z.infer<typeof createAssetLifecycleEventSchema>
export type UpdateAssetLifecycleEvent = z.infer<typeof updateAssetLifecycleEventSchema>

export type AssetIntelligenceInsight = z.infer<typeof assetIntelligenceInsightSchema>
export type CreateAssetIntelligenceInsight = z.infer<typeof createAssetIntelligenceInsightSchema>
export type UpdateAssetIntelligenceInsight = z.infer<typeof updateAssetIntelligenceInsightSchema>

export type AssetWorkflow = z.infer<typeof assetWorkflowSchema>
export type CreateAssetWorkflow = z.infer<typeof createAssetWorkflowSchema>
export type UpdateAssetWorkflow = z.infer<typeof updateAssetWorkflowSchema>

export type AssetFilter = z.infer<typeof assetFilterSchema>
export type InsightFilter = z.infer<typeof insightFilterSchema>
export type BulkAssetUpdate = z.infer<typeof bulkAssetUpdateSchema>
export type BulkInsightAction = z.infer<typeof bulkInsightActionSchema>
export type AssetAnalysisRequest = z.infer<typeof assetAnalysisRequestSchema>
export type WorkflowExecutionRequest = z.infer<typeof workflowExecutionRequestSchema>
