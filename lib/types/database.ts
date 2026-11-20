import type { Database as DB } from "@/lib/supabase/database.types"

export type {
  CreateDatabaseConnection as CreateDatabaseConnectionInput,
  UpdateDatabaseConnection as UpdateDatabaseConnectionInput,
} from "@/lib/schemas/data-sources"

export interface DatabaseConnection {
  id: string
  user_id: string
  name: string
  description: string | null
  connection_type: "postgresql" | "mysql" | "sqlserver" | "bigquery" | "snowflake"
  host: string | null
  port: number | null
  database_name: string | null
  username: string | null
  password: string | null
  connection_string: string | null
  ssl_mode: string | null
  additional_params: Record<string, any> | null
  is_active: boolean
  last_tested_at: string | null
  last_test_status: string | null
  last_test_error: string | null
  created_at: string
  updated_at: string
}

export interface AIModel {
  id: string
  name: string
  provider: string
  model_id: string
  description: string | null
  capabilities: string[]
  parameters: Record<string, any>
  cost_per_1k_tokens: number | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface AIAgent {
  id: string
  name: string
  description: string | null
  system_prompt: string | null
  model_id: string
  user_id: string
  parameters: Record<string, any>
  tools: any[]
  is_active: boolean
  created_at: string
  updated_at: string
  max_tokens: number
}

export interface DataEmbedding {
  id: string
  name: string
  description: string | null
  source_type: string
  source_id: string | null
  embedding_model: string
  vector_data: string | null
  metadata: Record<string, any> | null
  user_id: string
  created_at: string
  updated_at: string | null
}

export interface EmbeddingFile {
  id: string
  file_name: string
  file_type: string
  file_size: number
  file_path: string
  embedding_id: string | null
  user_id: string
  created_at: string
  updated_at: string
}

export interface EmbeddingJob {
  id: string
  status: "pending" | "processing" | "completed" | "failed"
  job_type: string
  embedding_id: string | null
  file_ids: string[] | null
  parameters: Record<string, any>
  result: Record<string, any> | null
  error: string | null
  user_id: string
  created_at: string
  updated_at: string
}

export interface EmbeddingUsage {
  id: string
  embedding_id: string
  agent_id: string | null
  query: string | null
  tokens_used: number | null
  similarity_score: number | null
  user_id: string
  created_at: string
}

export interface UserSettings {
  id: string
  user_id: string
  settings_type: string
  settings: Record<string, any>
  created_at: string
  updated_at: string
}

export interface AIAgentSettings {
  id: string
  user_id: string
  agent_id: string
  settings_type: string
  settings: Record<string, any>
  created_at: string
  updated_at: string
}

export interface SupplyChainData {
  id: string
  name: string
  description: string | null
  data_type: string
  data: Record<string, any>
  metadata: Record<string, any>
  user_id: string
  created_at: string
  updated_at: string
}

export interface ReusablePackage {
  id: string
  package_id: string
  name: string
  description: string | null
  dimensions: {
    length: number
    width: number
    height: number
    unit: string
  }
  weight_capacity: number
  material: string | null
  reuse_count: number
  status: "available" | "in_use" | "damaged" | "retired"
  location_id: string | null
  metadata: Record<string, any>
  created_at: string
  updated_at: string
}

export interface Shipping {
  id: string
  user_id: string
  tracking_number: string
  status: string
  origin_address: {
    name: string
    street: string
    city: string
    state: string
    zip: string
    country: string
  }
  destination_address: {
    name: string
    street: string
    city: string
    state: string
    zip: string
    country: string
  }
  shipping_date: string | null
  estimated_delivery: string | null
  actual_delivery: string | null
  carrier: string
  service_level: string
  package_ids: string[] | null
  weight: number | null
  dimensions: {
    length: number
    width: number
    height: number
    unit: string
  } | null
  shipping_cost: number | null
  currency: string
  notes: string | null
  created_at: string
  updated_at: string
  public_id: string
  iot_data?: IoTData | null
}

export interface IoTData {
  device_id: string
  sensor_type: string
  is_refrigerated: boolean
  location_tracking: LocationPoint[]
  sensor_readings: SensorReading[]
  alerts: SensorAlert[]
}

export interface LocationPoint {
  timestamp: string
  latitude: number
  longitude: number
  accuracy: number
  facility_type: string
}

export interface SensorReading {
  timestamp: string
  temperature: {
    value: number
    unit: string
  }
  humidity: {
    value: number
    unit: string
  }
  pressure: {
    value: number
    unit: string
  }
  shock: {
    value: number
    unit: string
  }
  light: {
    value: number
    unit: string
  }
  battery: {
    value: number
    unit: string
  }
}

export interface SensorAlert {
  type: string
  severity: string
  timestamp: string
  message: string
  threshold: number
}

export interface AIAnalysisResult {
  id: string
  analysis_type: string
  source_type: string
  source_id: string
  agent_id: string | null
  results: Record<string, any>
  metadata: Record<string, any>
  user_id: string
  created_at: string
  updated_at: string
}

export interface AIWorkflow {
  id: string
  name: string
  description: string | null
  steps: any[]
  trigger_type: string | null
  trigger_config: Record<string, any>
  is_active: boolean
  user_id: string
  created_at: string
  updated_at: string
}

export interface AIWorkflowRun {
  id: string
  workflow_id: string
  status: "pending" | "running" | "completed" | "failed"
  start_time: string
  end_time: string | null
  results: Record<string, any>
  error: string | null
  user_id: string
  created_at: string
  updated_at: string
}

export interface DeveloperTool {
  id: string
  name: string
  tool_type: string
  configuration: Record<string, any>
  description: string | null
  is_active: boolean
  user_id: string
  created_at: string
  updated_at: string
}

export interface ShippingAnalytics {
  shipping_day: string
  total_shipments: number
  avg_estimated_delivery_days: number
  avg_actual_delivery_days: number
  total_cost: number
  avg_cost: number
  total_weight: number
  avg_weight: number
  delivered_count: number
  in_transit_count: number
  delayed_count: number
}

export interface PackageUtilization {
  id: string
  package_id: string
  name: string
  reuse_count: number
  status: string
  shipment_count: number
  last_used_date: string | null
  created_at: string
  days_since_creation: number
  reuses_per_day: number
}

export interface ExternalIntegration {
  id: string
  user_id: string
  provider: "shopify" | "wix"
  provider_shop_id?: string | null
  provider_site_id?: string | null
  encrypted_access_token: any // Represents bytea type
  scopes: string[] | null
  status: "active" | "revoked" | "error" | "pending"
  sync_status: "idle" | "syncing" | "completed" | "failed"
  last_sync_at?: string | null
  sync_error_message?: string | null
  created_at: string
  updated_at: string
}

export type UserManagedSupabaseProject = DB["public"]["Tables"]["user_managed_supabase_projects"]["Row"]
export type CreateUserManagedSupabaseProjectInput = DB["public"]["Tables"]["user_managed_supabase_projects"]["Insert"]
export type UpdateUserManagedSupabaseProjectInput = DB["public"]["Tables"]["user_managed_supabase_projects"]["Update"]

export interface CreateSupabaseProjectFormValues {
  displayName: string
  supabaseProjectName: string // This will be the 'name' sent to Supabase API
  region: SupabaseProjectRegion
  dbPass: string
}

export type SupabaseProjectRegion =
  | "us-east-1"
  | "us-west-1"
  | "us-west-2"
  | "ap-northeast-1"
  | "ap-northeast-2"
  | "ap-south-1"
  | "ap-southeast-1"
  | "ap-southeast-2"
  | "ca-central-1"
  | "eu-central-1"
  | "eu-west-1"
  | "eu-west-2"
  | "eu-west-3"
  | "sa-east-1"

export const availableSupabaseRegions: { value: SupabaseProjectRegion; label: string }[] = [
  { value: "us-east-1", label: "US East (N. Virginia)" },
  { value: "us-west-1", label: "US West (N. California)" },
  { value: "us-west-2", label: "US West (Oregon)" },
  { value: "ap-northeast-1", label: "Asia Pacific (Tokyo)" },
  { value: "ap-northeast-2", label: "Asia Pacific (Seoul)" },
  { value: "ap-south-1", label: "Asia Pacific (Mumbai)" },
  { value: "ap-southeast-1", label: "Asia Pacific (Singapore)" },
  { value: "ap-southeast-2", label: "Asia Pacific (Sydney)" },
  { value: "ca-central-1", label: "Canada (Central)" },
  { value: "eu-central-1", label: "EU (Frankfurt)" },
  { value: "eu-west-1", label: "EU (Ireland)" },
  { value: "eu-west-2", label: "EU (London)" },
  { value: "eu-west-3", label: "EU (Paris)" },
  { value: "sa-east-1", label: "South America (São Paulo)" },
]
