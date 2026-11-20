import { z } from "zod"
import type { Tables } from "@/types/supabase-types"

// AI Models Schema
export const aiModelSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(255),
  provider: z.string().min(1).max(100),
  model_id: z.string().min(1).max(255),
  model_type: z.string().default("text"),
  type: z.string().min(1).max(100),
  description: z.string().nullable(),
  capabilities: z.record(z.string(), z.any()).nullable(),
  parameters: z.record(z.string(), z.any()).nullable(),
  cost_per_1k_tokens: z.number().nullable(),
  is_active: z.boolean().default(true),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
})

// AI Agents Schema
export const aiAgentSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(255),
  description: z.string().nullable(),
  system_prompt: z.string().nullable(),
  model_id: z.string().uuid().nullable(),
  user_id: z.string().uuid(),
  parameters: z.record(z.string(), z.any()).nullable(),
  tools: z.record(z.string(), z.any()).nullable(),
  temperature: z.number().min(0).max(2).nullable(),
  max_tokens: z.number().min(1).max(100000).nullable(),
  is_active: z.boolean().default(true),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
})

// AI Workflows Schema
export const aiWorkflowSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(255),
  description: z.string().nullable(),
  steps: z.record(z.string(), z.any()),
  trigger_type: z.string().nullable(),
  trigger_config: z.record(z.string(), z.any()).nullable(),
  is_active: z.boolean().default(true),
  user_id: z.string().uuid(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
})

// AI Workflow Runs Schema
export const aiWorkflowRunSchema = z.object({
  id: z.string().uuid(),
  workflow_id: z.string().uuid().nullable(),
  user_id: z.string().uuid(),
  status: z.string().nullable(),
  start_time: z.string().datetime().nullable(),
  end_time: z.string().datetime().nullable(),
  results: z.record(z.string(), z.any()).nullable(),
  error: z.string().nullable(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
})

// AI Analysis Results Schema
export const aiAnalysisResultSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  agent_id: z.string().uuid().nullable(),
  source_type: z.string(),
  source_id: z.string(),
  analysis_type: z.string(),
  results: z.record(z.string(), z.any()),
  metadata: z.record(z.string(), z.any()).nullable(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
})

// Assets Schema
export const assetSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  asset_id: z.string(),
  name: z.string().min(1).max(255),
  description: z.string().nullable(),
  asset_type: z.string(),
  category: z.string().nullable(),
  status: z.string().default("active"),
  current_value: z.number().nullable(),
  purchase_cost: z.number().nullable(),
  purchase_date: z.string().datetime().nullable(),
  depreciation_rate: z.number().nullable(),
  current_location: z.record(z.string(), z.any()).nullable(),
  specifications: z.record(z.string(), z.any()).nullable(),
  maintenance_schedule: z.record(z.string(), z.any()).nullable(),
  compliance_data: z.record(z.string(), z.any()).nullable(),
  esg_metrics: z.record(z.string(), z.any()).nullable(),
  predictive_data: z.record(z.string(), z.any()).nullable(),
  risk_score: z.number().nullable(),
  ai_agent_config: z.record(z.string(), z.any()).nullable(),
  workflow_settings: z.record(z.string(), z.any()).nullable(),
  metadata: z.record(z.string(), z.any()).nullable(),
  qr_code: z.string().nullable(),
  nfc_tag_id: z.string().nullable(),
  iot_sensor_id: z.string().nullable(),
  location_id: z.string().nullable(),
  embedding_vector: z.string().nullable(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
})

// Asset Intelligence Agent Templates Schema
export const assetIntelligenceAgentTemplateSchema = z.object({
  id: z.string().uuid(),
  template_id: z.string(),
  name: z.string().min(1).max(255),
  description: z.string(),
  icon: z.string(),
  system_prompt: z.string(),
  tools: z.array(z.string()),
  parameters: z.record(z.string(), z.any()),
  category: z.string(),
  asset_types: z.array(z.string()),
  capabilities: z.array(z.string()),
  business_value: z.string().nullable(),
  is_active: z.boolean().default(true),
  version: z.number().int(),
  created_at: z.string().datetime().nullable(),
  updated_at: z.string().datetime().nullable(),
})

// Asset Agent Configs Schema
export const assetAgentConfigSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  agent_id: z.string().uuid(),
  template_id: z.string(),
  target_assets: z.record(z.string(), z.any()),
  notification_threshold: z.string().default("medium"),
  auto_insights: z.boolean().default(true),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
})

// Asset Workflows Schema
export const assetWorkflowSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  name: z.string().min(1).max(255),
  description: z.string().nullable(),
  asset_type: z.string().nullable(),
  steps: z.any(),
  trigger_config: z.record(z.string(), z.any()),
  trigger_type: z.string().nullable(),
  ai_model: z.string().nullable(),
  is_active: z.boolean().default(true),
  execution_count: z.number().default(0),
  last_executed_at: z.string().datetime().nullable(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
})

// Data Embeddings Schema
export const dataEmbeddingSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  name: z.string().min(1).max(255),
  description: z.string().nullable(),
  source_type: z.string(),
  source_id: z.string().nullable(),
  embedding_model: z.string(),
  vector_data: z.string().nullable(),
  metadata: z.record(z.string(), z.any()).nullable(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
})

// System AI Agents Schema
export const systemAiAgentSchema = z.object({
  id: z.string().uuid(),
  template_id: z.string(),
  name: z.string().min(1).max(255),
  description: z.string(),
  icon: z.string(),
  system_prompt: z.string(),
  tools: z.any(),
  parameters: z.record(z.string(), z.any()),
  category: z.string(),
  tags: z.array(z.string()).nullable(),
  difficulty: z.string().nullable(),
  estimated_setup_time: z.number().nullable(),
  use_cases: z.array(z.string()).nullable(),
  version: z.string().nullable(),
  is_active: z.boolean().nullable(),
  is_featured: z.boolean().nullable(),
  created_at: z.string().datetime().nullable(),
  updated_at: z.string().datetime().nullable(),
})

// Export types
export type AIModel = z.infer<typeof aiModelSchema>
export type AIAgent = z.infer<typeof aiAgentSchema>
export type AIWorkflow = z.infer<typeof aiWorkflowSchema>
export type AIWorkflowRun = z.infer<typeof aiWorkflowRunSchema>
export type AIAnalysisResult = z.infer<typeof aiAnalysisResultSchema>
export type Asset = z.infer<typeof assetSchema>
export type AssetIntelligenceAgentTemplate = z.infer<typeof assetIntelligenceAgentTemplateSchema>
export type AssetAgentConfig = z.infer<typeof assetAgentConfigSchema>
export type AssetWorkflow = z.infer<typeof assetWorkflowSchema>
export type DataEmbedding = z.infer<typeof dataEmbeddingSchema>
export type SystemAIAgent = z.infer<typeof systemAiAgentSchema>

export type AIModelSummary = Pick<AIModel, "id" | "name" | "provider" | "model_id">
export type AIAgentSummary = Pick<AIAgent, "id" | "name" | "description">
export type AIWorkflowSummary = Pick<AIWorkflow, "id" | "name" | "description">

export type TokenizedAsset = Tables<"asset_tokens">
export type TokenOffer = Tables<"token_offers">
export type TokenTransaction = Tables<"token_transactions">
export type FractionalOwnership = Tables<"fractional_ownerships">
