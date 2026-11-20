"use server"

import { createServerSupabaseClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import { after } from "next/server"
import { triggerWebhooks } from "@/lib/webhooks/webhook-delivery"
import {
  createAssetSchema,
  updateAssetSchema,
  createAssetLifecycleEventSchema,
  createAssetWorkflowSchema,
  assetFilterSchema,
  insightFilterSchema,
  bulkAssetUpdateSchema,
  bulkInsightActionSchema,
  workflowExecutionRequestSchema,
  type CreateAsset,
  type UpdateAsset,
  type AssetFilter,
  type CreateAssetLifecycleEvent,
  type AssetAnalysisRequest,
  type InsightFilter,
  type BulkAssetUpdate,
  type BulkInsightAction,
  type CreateAssetWorkflow,
  type WorkflowExecutionRequest,
} from "@/lib/schemas/asset-intelligence"
import * as z from "zod"
import { AssetIntelligenceSystem } from "@/lib/asset-intelligence/asset-system"
import { AIClient } from "@/lib/ai/ai-client"
import { recordTokenUsage } from "@/lib/stripe/metering"

async function createAssetIntelligenceSystem(supabase) {
  return new AssetIntelligenceSystem(supabase)
}

function assetEventPayload(asset: {
  id: string
  asset_id?: string | null
  name?: string | null
  asset_type?: string | null
  status?: string | null
}) {
  return {
    assetId: asset.id,
    assetTag: asset.asset_id,
    name: asset.name,
    assetType: asset.asset_type,
    status: asset.status,
    timestamp: new Date().toISOString(),
  }
}

// Asset CRUD Operations
export async function createAsset(formData: CreateAsset) {
  const supabase = await createServerSupabaseClient()

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return { success: false, error: "User not authenticated" }
    }

    const validatedData = createAssetSchema.parse({
      ...formData,
      user_id: user.id,
      asset_id: formData.asset_id || `AST-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`,
      qr_code: formData.qr_code || `QR-${Date.now()}-${Math.random().toString(36).substr(2, 8).toUpperCase()}`,
    })

    const { data, error } = await supabase.from("assets").insert([validatedData]).select().single()

    if (error) {
      console.error("Error creating asset:", error)
      return { success: false, error: error.message }
    }

    await createAssetLifecycleEvent({
      asset_id: data.id,
      event_type: "created",
      event_status: "completed",
      description: `Asset ${data.name} created`,
      user_id: user.id,
    })

    after(() => triggerWebhooks({ userId: user.id, event: "asset.created", payload: assetEventPayload(data) }))

    revalidatePath("/ai-suite/asset-intelligence")
    return { success: true, data }
  } catch (error) {
    console.error("Error in createAsset:", error)
    if (error instanceof z.ZodError) {
      return { success: false, error: error.issues[0].message }
    }
    return { success: false, error: "An unexpected error occurred" }
  }
}

export async function updateAsset(formData: UpdateAsset) {
  const supabase = await createServerSupabaseClient()

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return { success: false, error: "User not authenticated" }
    }

    const validatedData = updateAssetSchema.parse(formData)

    // Check ownership
    const { data: existingAsset, error: fetchError } = await supabase
      .from("assets")
      .select("id")
      .eq("id", validatedData.id)
      .eq("user_id", user.id)
      .single()

    if (fetchError || !existingAsset) {
      return { success: false, error: "Asset not found or access denied" }
    }

    const { data, error } = await supabase
      .from("assets")
      .update({
        ...validatedData,
        updated_at: new Date().toISOString(),
      })
      .eq("id", validatedData.id)
      .select()
      .single()

    if (error) {
      console.error("Error updating asset:", error)
      return { success: false, error: error.message }
    }

    after(() => triggerWebhooks({ userId: user.id, event: "asset.updated", payload: assetEventPayload(data) }))

    revalidatePath("/ai-suite/asset-intelligence")
    return { success: true, data }
  } catch (error) {
    console.error("Error in updateAsset:", error)
    if (error instanceof z.ZodError) {
      return { success: false, error: error.issues[0].message }
    }
    return { success: false, error: "An unexpected error occurred" }
  }
}

export async function deleteAsset(assetId: string) {
  const supabase = await createServerSupabaseClient()

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return { success: false, error: "User not authenticated" }
    }

    // Check ownership
    const { data: existingAsset, error: fetchError } = await supabase
      .from("assets")
      .select("id")
      .eq("id", assetId)
      .eq("user_id", user.id)
      .single()

    if (fetchError || !existingAsset) {
      return { success: false, error: "Asset not found or access denied" }
    }

    const { error } = await supabase.from("assets").delete().eq("id", assetId)

    if (error) {
      console.error("Error deleting asset:", error)
      return { success: false, error: error.message }
    }

    revalidatePath("/ai-suite/asset-intelligence")
    return { success: true }
  } catch (error) {
    console.error("Error in deleteAsset:", error)
    return { success: false, error: "An unexpected error occurred" }
  }
}

export async function getAssets(filters?: AssetFilter) {
  const supabase = await createServerSupabaseClient()

  try {
    console.log("[v0] getAssets - Starting asset fetch...")

    const {
      data: { user },
    } = await supabase.auth.getUser()

    console.log("[v0] getAssets - User authentication check:", {
      authenticated: !!user,
      userId: user?.id,
      timestamp: new Date().toISOString(),
    })

    if (!user) {
      console.error("[v0] getAssets - User not authenticated")
      return { success: false, error: "User not authenticated", data: [] }
    }

    const validatedFilters = filters ? assetFilterSchema.parse(filters) : {}

    let assetsQuery = supabase
      .from("assets")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })

    // Apply filters to assets
    if (validatedFilters.asset_type) {
      assetsQuery = assetsQuery.eq("asset_type", validatedFilters.asset_type)
    }
    if (validatedFilters.status) {
      assetsQuery = assetsQuery.eq("status", validatedFilters.status)
    }
    if (validatedFilters.category) {
      assetsQuery = assetsQuery.eq("category", validatedFilters.category)
    }
    if (validatedFilters.has_iot !== undefined) {
      assetsQuery = validatedFilters.has_iot
        ? assetsQuery.not("iot_sensor_id", "is", null)
        : assetsQuery.is("iot_sensor_id", null)
    }
    if (validatedFilters.location_id) {
      assetsQuery = assetsQuery.eq("location_id", validatedFilters.location_id)
    }
    if (validatedFilters.min_value) {
      assetsQuery = assetsQuery.gte("current_value", validatedFilters.min_value)
    }
    if (validatedFilters.max_value) {
      assetsQuery = assetsQuery.lte("current_value", validatedFilters.max_value)
    }
    if (validatedFilters.search_query) {
      assetsQuery = assetsQuery.or(
        `name.ilike.%${validatedFilters.search_query}%,description.ilike.%${validatedFilters.search_query}%`,
      )
    }

    // Execute assets query
    const { data: assetsData, error: assetsError } = await assetsQuery

    if (assetsError) {
      console.error("[v0] getAssets - Error fetching assets:", assetsError)
      return { success: false, error: assetsError.message, data: [] }
    }

    const { data: iotSensorsData, error: iotError } = await supabase
      .from("iot_sensor_data")
      .select("iot_sensor_id, asset_id, temperature, humidity, battery_level, timestamp, location, metadata")
      .order("timestamp", { ascending: false })

    let uniqueIotSensors: any[] = []
    if (!iotError && iotSensorsData) {
      // Group by iot_sensor_id and get the most recent reading for each
      const sensorMap = new Map()
      iotSensorsData.forEach((reading) => {
        if (!sensorMap.has(reading.iot_sensor_id)) {
          sensorMap.set(reading.iot_sensor_id, reading)
        }
      })

      // Convert IoT sensor readings to asset-like objects
      uniqueIotSensors = Array.from(sensorMap.values()).map((sensor) => ({
        id: sensor.iot_sensor_id,
        name: `IoT Sensor ${sensor.iot_sensor_id}`,
        asset_type: "iot-device",
        category: "IoT Sensors",
        status: sensor.battery_level && sensor.battery_level > 20 ? "active" : "maintenance",
        iot_sensor_id: sensor.iot_sensor_id,
        current_value: 0,
        description: `IoT Sensor with ${sensor.temperature ? "temperature" : ""}${sensor.temperature && sensor.humidity ? " and " : ""}${sensor.humidity ? "humidity" : ""} monitoring`,
        location_id: sensor.location ? JSON.stringify(sensor.location) : null,
        user_id: user.id,
        created_at: sensor.timestamp,
        updated_at: sensor.timestamp,
        metadata: {
          ...sensor.metadata,
          temperature: sensor.temperature,
          humidity: sensor.humidity,
          battery_level: sensor.battery_level,
          is_iot_sensor: true,
          linked_asset_id: sensor.asset_id,
        },
      }))

      console.log("[v0] getAssets - IoT sensors fetched:", {
        count: uniqueIotSensors.length,
        sensorIds: uniqueIotSensors.map((s) => s.iot_sensor_id),
      })
    }

    const allAssets = [...(assetsData || []), ...uniqueIotSensors]

    console.log("[v0] getAssets - Query result:", {
      success: true,
      regularAssets: assetsData?.length || 0,
      iotSensors: uniqueIotSensors.length,
      totalAssets: allAssets.length,
      timestamp: new Date().toISOString(),
    })

    return { success: true, data: allAssets }
  } catch (error) {
    console.error("[v0] getAssets - Exception:", {
      error,
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    })

    return {
      success: false,
      error: error instanceof Error ? error.message : "An unexpected error occurred",
      data: [],
    }
  }
}

// Asset Lifecycle Event Operations
export async function createAssetLifecycleEvent(formData: CreateAssetLifecycleEvent) {
  const supabase = await createServerSupabaseClient()

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return { success: false, error: "User not authenticated" }
    }

    const validatedData = createAssetLifecycleEventSchema.parse({
      ...formData,
      user_id: user.id,
    })

    // Verify asset ownership
    const { data: asset, error: assetError } = await supabase
      .from("assets")
      .select("id")
      .eq("id", validatedData.asset_id)
      .eq("user_id", user.id)
      .single()

    if (assetError || !asset) {
      return { success: false, error: "Asset not found or access denied" }
    }

    const { data, error } = await supabase.from("asset_lifecycle_events").insert([validatedData]).select().single()

    if (error) {
      console.error("Error creating lifecycle event:", error)
      return { success: false, error: error.message }
    }

    revalidatePath("/ai-suite/asset-intelligence")
    return { success: true, data }
  } catch (error) {
    console.error("Error in createAssetLifecycleEvent:", error)
    if (error instanceof z.ZodError) {
      return { success: false, error: error.issues[0].message }
    }
    return { success: false, error: "An unexpected error occurred" }
  }
}

// Asset Intelligence Insight Operations
export async function generateAssetInsights(request: AssetAnalysisRequest) {
  const supabase = await createServerSupabaseClient()

  try {
    console.log("[v0] generateAssetInsights request:", JSON.stringify(request, null, 2))

    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return { success: false, error: "User not authenticated" }
    }

    const validatedRequest = request

    // Validate asset_id is a UUID
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (!validatedRequest.asset_id || !uuidRegex.test(validatedRequest.asset_id)) {
      return { success: false, error: "Invalid asset_id format - must be a UUID" }
    }

    // Validate analysis_types is an array
    if (!validatedRequest.analysis_types || !Array.isArray(validatedRequest.analysis_types)) {
      return { success: false, error: "analysis_types must be an array" }
    }

    if (validatedRequest.analysis_types.length === 0) {
      return { success: false, error: "At least one analysis type is required" }
    }

    // Log analysis_types for debugging
    console.log(
      "[v0] analysis_types type:",
      typeof validatedRequest.analysis_types,
      Array.isArray(validatedRequest.analysis_types),
    )
    validatedRequest.analysis_types.forEach((type, index) => {
      console.log(`[v0] analysis_types[${index}]:`, typeof type, JSON.stringify(type))
    })

    // Validate each analysis type
    const validTypes = [
      "predictive_maintenance",
      "cost_optimization",
      "utilization_analysis",
      "compliance_risk",
      "esg_impact",
      "lifecycle_prediction",
    ]

    for (const type of validatedRequest.analysis_types) {
      if (typeof type !== "string" || !validTypes.includes(type)) {
        return { success: false, error: `Invalid analysis type: ${type}. Must be one of: ${validTypes.join(", ")}` }
      }
    }

    // Verify asset exists and user has access
    const { data: asset, error: assetError } = await supabase
      .from("assets")
      .select("id")
      .eq("id", validatedRequest.asset_id)
      .eq("user_id", user.id)
      .single()

    if (assetError || !asset) {
      return { success: false, error: "Asset not found or access denied" }
    }

    try {
      const assetIntelligenceSystem = new AssetIntelligenceSystem(supabase)
      const insights = await assetIntelligenceSystem.generateAssetInsights(validatedRequest.asset_id, user.id)

      revalidatePath("/ai-suite/asset-intelligence")
      return { success: true, data: insights }
    } catch (systemError) {
      console.error("[v0] Error in AssetIntelligenceSystem.generateAssetInsights:", systemError)

      if (systemError instanceof Error) {
        return { success: false, error: `Asset intelligence system error: ${systemError.message}` }
      }

      return { success: false, error: `Asset intelligence system error: ${String(systemError)}` }
    }
  } catch (error) {
    console.error("Error in generateAssetInsights:", error)

    // Handle Error objects
    if (error instanceof Error) {
      return { success: false, error: error.message || "An unexpected error occurred" }
    }

    // Handle any other type of error
    return { success: false, error: String(error) || "An unexpected error occurred" }
  }
}

export async function getAssetInsights(assetId: string, filters?: InsightFilter) {
  const supabase = await createServerSupabaseClient()

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return { success: false, error: "User not authenticated" }
    }

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (!uuidRegex.test(assetId)) {
      console.error("[v0] Invalid asset ID format:", assetId)
      return { success: false, error: "Invalid asset ID format" }
    }

    const validatedFilters = filters ? insightFilterSchema.parse(filters) : {}

    // Verify asset ownership
    const { data: asset, error: assetError } = await supabase
      .from("assets")
      .select("id")
      .eq("id", assetId)
      .eq("user_id", user.id)
      .single()

    if (assetError || !asset) {
      console.error("[v0] Asset not found or access denied:", { assetId, error: assetError })
      return { success: false, error: "Asset not found or access denied" }
    }

    let query = supabase
      .from("asset_intelligence_insights")
      .select("*")
      .eq("asset_id", assetId)
      .eq("user_id", user.id)
      .order("priority", { ascending: false })
      .order("created_at", { ascending: false })

    // Apply filters
    if (validatedFilters.insight_type) {
      query = query.eq("insight_type", validatedFilters.insight_type)
    }
    if (validatedFilters.priority) {
      query = query.eq("priority", validatedFilters.priority)
    }
    if (validatedFilters.status) {
      query = query.eq("status", validatedFilters.status)
    }
    if (validatedFilters.min_confidence) {
      query = query.gte("confidence_score", validatedFilters.min_confidence)
    }

    const { data, error } = await query

    if (error) {
      console.error("Error fetching insights:", error)
      return { success: false, error: error.message }
    }

    return { success: true, data: data || [] }
  } catch (error) {
    console.error("Error in getAssetInsights:", error)
    if (error instanceof z.ZodError) {
      return { success: false, error: error.issues[0].message }
    }
    return { success: false, error: "An unexpected error occurred" }
  }
}

export async function updateInsightStatus(insightId: string, status: "acknowledged" | "resolved" | "dismissed") {
  const supabase = await createServerSupabaseClient()

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return { success: false, error: "User not authenticated" }
    }

    // Check ownership
    const { data: existingInsight, error: fetchError } = await supabase
      .from("asset_intelligence_insights")
      .select("id")
      .eq("id", insightId)
      .eq("user_id", user.id)
      .single()

    if (fetchError || !existingInsight) {
      return { success: false, error: "Insight not found or access denied" }
    }

    const { data, error } = await supabase
      .from("asset_intelligence_insights")
      .update({
        status,
        updated_at: new Date().toISOString(),
      })
      .eq("id", insightId)
      .select()
      .single()

    if (error) {
      console.error("Error updating insight status:", error)
      return { success: false, error: error.message }
    }

    revalidatePath("/ai-suite/asset-intelligence")
    return { success: true, data }
  } catch (error) {
    console.error("Error in updateInsightStatus:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "An unexpected error occurred",
    }
  }
}

export async function getAllUserInsights() {
  const supabase = await createServerSupabaseClient()

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return { success: false, error: "User not authenticated" }
    }

    const { data, error } = await supabase
      .from("asset_intelligence_insights")
      .select(`
        *,
        assets (
          name,
          asset_type
        )
      `)
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(100)

    if (error) {
      console.error("Error fetching all user insights:", error)
      return { success: false, error: error.message }
    }

    return { success: true, data: data || [] }
  } catch (error) {
    console.error("Error in getAllUserInsights:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "An unexpected error occurred",
    }
  }
}

// Bulk Operations
export async function bulkUpdateAssets(request: BulkAssetUpdate) {
  const supabase = await createServerSupabaseClient()

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return { success: false, error: "User not authenticated" }
    }

    const validatedRequest = bulkAssetUpdateSchema.parse(request)

    // Verify all assets belong to user
    const { data: assets, error: assetsError } = await supabase
      .from("assets")
      .select("id")
      .in("id", validatedRequest.asset_ids)
      .eq("user_id", user.id)

    if (assetsError || !assets || assets.length !== validatedRequest.asset_ids.length) {
      return { success: false, error: "Some assets not found or access denied" }
    }

    const { data, error } = await supabase
      .from("assets")
      .update({
        ...validatedRequest.updates,
        updated_at: new Date().toISOString(),
      })
      .in("id", validatedRequest.asset_ids)
      .select()

    if (error) {
      console.error("Error bulk updating assets:", error)
      return { success: false, error: error.message }
    }

    after(async () => {
      for (const asset of data ?? []) {
        await triggerWebhooks({ userId: user.id, event: "asset.updated", payload: assetEventPayload(asset) })
      }
    })

    revalidatePath("/ai-suite/asset-intelligence")
    return { success: true, data }
  } catch (error) {
    console.error("Error in bulkUpdateAssets:", error)
    if (error instanceof z.ZodError) {
      return { success: false, error: error.issues[0].message }
    }
    return { success: false, error: "An unexpected error occurred" }
  }
}

export async function bulkInsightAction(request: BulkInsightAction) {
  const supabase = await createServerSupabaseClient()

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return { success: false, error: "User not authenticated" }
    }

    const validatedRequest = bulkInsightActionSchema.parse(request)

    // Verify all insights belong to user
    const { data: insights, error: insightsError } = await supabase
      .from("asset_intelligence_insights")
      .select("id")
      .in("id", validatedRequest.insight_ids)
      .eq("user_id", user.id)

    if (insightsError || !insights || insights.length !== validatedRequest.insight_ids.length) {
      return { success: false, error: "Some insights not found or access denied" }
    }

    const { data, error } = await supabase
      .from("asset_intelligence_insights")
      .update({
        status:
          validatedRequest.action === "acknowledge"
            ? "acknowledged"
            : validatedRequest.action === "resolve"
              ? "resolved"
              : "dismissed",
        updated_at: new Date().toISOString(),
      })
      .in("id", validatedRequest.insight_ids)
      .select()

    if (error) {
      console.error("Error bulk updating insights:", error)
      return { success: false, error: error.message }
    }

    revalidatePath("/ai-suite/asset-intelligence")
    return { success: true, data }
  } catch (error) {
    console.error("Error in bulkInsightAction:", error)
    if (error instanceof z.ZodError) {
      return { success: false, error: error.issues[0].message }
    }
    return { success: false, error: "An unexpected error occurred" }
  }
}

// Workflow Operations
export async function createAssetWorkflow(formData: CreateAssetWorkflow) {
  const supabase = await createServerSupabaseClient()

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return { success: false, error: "User not authenticated" }
    }

    const validatedData = createAssetWorkflowSchema.parse({
      ...formData,
      user_id: user.id,
    })

    const { data, error } = await supabase.from("asset_workflows").insert([validatedData]).select().single()

    if (error) {
      console.error("Error creating asset workflow:", error)
      return { success: false, error: error.message }
    }

    revalidatePath("/ai-suite/asset-intelligence")
    return { success: true, data }
  } catch (error) {
    console.error("Error in createAssetWorkflow:", error)
    if (error instanceof z.ZodError) {
      return { success: false, error: error.issues[0].message }
    }
    return { success: false, error: "An unexpected error occurred" }
  }
}

export async function executeAssetWorkflow(request: WorkflowExecutionRequest) {
  const supabase = await createServerSupabaseClient()

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return { success: false, error: "User not authenticated" }
    }

    const validatedRequest = workflowExecutionRequestSchema.parse(request)

    // Verify workflow and asset ownership
    const { data: workflow, error: workflowError } = await supabase
      .from("asset_workflows")
      .select("*")
      .eq("id", validatedRequest.workflow_id)
      .eq("user_id", user.id)
      .single()

    if (workflowError || !workflow) {
      return { success: false, error: "Workflow not found or access denied" }
    }

    const { data: asset, error: assetError } = await supabase
      .from("assets")
      .select("*")
      .eq("id", validatedRequest.asset_id)
      .eq("user_id", user.id)
      .single()

    if (assetError || !asset) {
      return { success: false, error: "Asset not found or access denied" }
    }

    const assetIntelligenceSystem = await createAssetIntelligenceSystem(supabase)
    const result = await assetIntelligenceSystem.executeAssetWorkflow(
      validatedRequest.workflow_id,
      validatedRequest.asset_id,
      user.id,
    )

    // Update workflow execution count
    await supabase
      .from("asset_workflows")
      .update({
        execution_count: workflow.execution_count + 1,
        last_executed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", validatedRequest.workflow_id)

    revalidatePath("/ai-suite/asset-intelligence")
    return { success: true, data: result }
  } catch (error) {
    console.error("Error in executeAssetWorkflow:", error)
    if (error instanceof z.ZodError) {
      return { success: false, error: error.issues[0].message }
    }
    return { success: false, error: "An unexpected error occurred" }
  }
}

// Analytics and Reporting
export async function getAssetAnalytics() {
  const supabase = await createServerSupabaseClient()

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return { success: false, error: "User not authenticated" }
    }

    const { data, error } = await supabase.from("asset_analytics").select("*").eq("user_id", user.id)

    if (error) {
      console.error("Error fetching asset analytics:", error)
      return { success: false, error: error.message }
    }

    return { success: true, data: data || [] }
  } catch (error) {
    console.error("Error in getAssetAnalytics:", error)
    return { success: false, error: "An unexpected error occurred" }
  }
}

export async function getActiveAgents() {
  const supabase = await createServerSupabaseClient()

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return { success: false, error: "User not authenticated" }
    }

    const { data, error } = await supabase
      .from("ai_agents")
      .select("*")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .order("created_at", { ascending: false })

    if (error) {
      console.error("Error fetching active agents:", error)
      return { success: false, error: error.message }
    }

    return { success: true, data: data || [] }
  } catch (error) {
    console.error("Error in getActiveAgents:", error)
    return { success: false, error: "An unexpected error occurred" }
  }
}

export async function executeAgent({
  agentId,
  prompt,
  assetIds = [],
  tables = [],
  endpoints = [],
  includeLearningData = false,
  dataStreamIds = [],
}: {
  agentId: string
  prompt: string
  assetIds?: string[]
  tables?: string[]
  endpoints?: string[]
  includeLearningData?: boolean
  dataStreamIds?: string[]
}) {
  const supabase = await createServerSupabaseClient()

  try {
    console.log("[v0] executeAgent (asset intelligence) called with agentId:", agentId)
    console.log("[v0] Prompt:", prompt)
    console.log("[v0] Asset IDs:", assetIds)
    console.log("[v0] Tables:", tables)
    console.log("[v0] Endpoints:", endpoints)

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return { success: false, error: "User not authenticated" }
    }

    // Get the agent details
    const { data: agent, error: agentError } = await supabase
      .from("ai_agents")
      .select("*, ai_models(*)")
      .eq("id", agentId)
      .eq("user_id", user.id)
      .maybeSingle()

    if (agentError) {
      console.error("Error fetching agent:", agentError)
      return { success: false, error: `Error fetching agent: ${agentError.message}` }
    }

    if (!agent) {
      return { success: false, error: "Agent not found" }
    }

    // Initialize the Asset Intelligence System
    const assetIntelligenceSystem = await createAssetIntelligenceSystem(supabase)

    let assetContext = ""
    const assetInsights: any[] = []

    // Get asset context and generate insights if asset IDs provided
    if (assetIds && assetIds.length > 0) {
      const { data: assets, error: assetsError } = await supabase
        .from("assets")
        .select("*")
        .in("id", assetIds)
        .eq("user_id", user.id)

      if (!assetsError && assets && assets.length > 0) {
        // Generate insights for each asset using AssetIntelligenceSystem
        for (const asset of assets) {
          try {
            const insights = await assetIntelligenceSystem.generateAssetInsights(asset.id, user.id)
            assetInsights.push(...insights)
          } catch (error) {
            console.error(`Error generating insights for asset ${asset.id}:`, error)
          }
        }

        assetContext = `\n\nAsset Context:\n${assets
          .map(
            (asset: any) =>
              `- ${asset.name} (${asset.asset_type}): ${asset.description || "No description"}\n  Status: ${asset.status}, Value: $${asset.current_value || 0}`,
          )
          .join("\n")}`

        if (assetInsights.length > 0) {
          assetContext += `\n\nAsset Intelligence Insights:\n${assetInsights
            .map(
              (insight: any) =>
                `- ${insight.insight_type}: ${insight.priority} priority (${Math.round(insight.confidence_score * 100)}% confidence)\n  ${JSON.stringify(insight.insight_data)}`,
            )
            .join("\n")}`
        }
      }
    }

    // Build comprehensive context for the AI agent
    const systemPrompt =
      agent.system_prompt ||
      `You are ${agent.name}, an asset intelligence agent specializing in analyzing and optimizing physical and digital assets.`

    const fullPrompt = `${systemPrompt}

User Request: ${prompt}
${assetContext}

Provide a comprehensive analysis and actionable recommendations based on the asset data and insights provided.`

    // Execute using AI client
    const aiClient = new AIClient()
    const startTime = Date.now()

    let finalResponse = ""
    const toolCalls: any[] = []

    try {
      // Use the agent's configured model or default to gpt-4
      const modelId = agent.model_id || "openai/gpt-4o-mini"

      const completion = await aiClient.createChatCompletion({
        model: modelId,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: fullPrompt },
        ],
        temperature: agent.parameters?.temperature || 0.7,
        maxTokens: agent.parameters?.max_tokens || 1000,
      })

      finalResponse = completion.content || "No response generated"

      if (completion.toolCalls && completion.toolCalls.length > 0) {
        toolCalls.push(...completion.toolCalls)
      }

      // Meter token usage — fire-and-forget, must not block or throw
      const usageTokens = (completion as any)?.usage?.total_tokens ?? Math.ceil(finalResponse.length / 4)
      if (usageTokens > 0) {
        recordTokenUsage({
          userId: user.id,
          operationId: crypto.randomUUID(),
          operationType: "analysis",
          totalTokens: usageTokens,
          promptTokens: (completion as any)?.usage?.prompt_tokens ?? 0,
          completionTokens: (completion as any)?.usage?.completion_tokens ?? 0,
          modelId: modelId,
          agentId,
        }).catch((err) => console.error("[AssetIntelligence] Metering error (non-fatal):", err))
      }
    } catch (aiError) {
      console.error("Error calling AI model:", aiError)
      // Fallback to intelligent summary if AI call fails
      finalResponse = `Asset Intelligence Analysis for ${agent.name}:

${prompt}

Based on the provided asset context:
${assetContext}

Analysis Summary:
- ${assetIds.length} asset(s) analyzed
- ${assetInsights.length} intelligence insight(s) generated
- Recommendations: Review the asset insights above for actionable items

This is a fallback response due to AI model unavailability. Please check your API keys and try again.`
    }

    const elapsedMs = Date.now() - startTime

    const response = {
      finalResponse: String(finalResponse), // Ensure it's a string
      toolCalls,
      tokens: finalResponse.length, // Approximate token count
      elapsedMs,
      iterations: 1,
      assetInsights: assetInsights.length > 0 ? assetInsights : undefined,
    }

    console.log("[v0] Agent execution completed successfully")

    return { success: true, data: response }
  } catch (error) {
    console.error("Error in executeAgent (asset intelligence):", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "An unexpected error occurred",
    }
  }
}

export async function getAssetAgents(userId: string) {
  const supabase = await createServerSupabaseClient()

  try {
    const { data, error } = await supabase.from("ai_agents").select("*").eq("user_id", userId)

    if (error) {
      console.error("Error fetching asset agents:", error)
      return { success: false, error: error.message }
    }

    return { success: true, data: data || [] }
  } catch (error) {
    console.error("Error in getAssetAgents:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "An unexpected error occurred",
    }
  }
}

// Agent Management Functions for Asset Insights Agent system
export async function updateInsightsAgentModel(modelId: string) {
  const supabase = await createServerSupabaseClient()

  try {
    // Get the authenticated user's ID from session
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return { success: false, error: "Authentication required" }
    }

    const userId = user.id

    // Validate modelId parameter
    if (!modelId || modelId === "undefined") {
      return { success: false, error: "Model ID is required" }
    }

    // Find the AI model record by model_id string identifier
    // Users can ONLY select from existing models - no creation allowed
    const { data: aiModel, error: modelError } = await supabase
      .from("ai_models")
      .select("id, name, model_id")
      .eq("model_id", modelId)
      .maybeSingle()

    if (modelError) {
      console.error("Error fetching AI model:", modelError)
      return { success: false, error: "Failed to fetch AI model" }
    }

    if (!aiModel) {
      // Model doesn't exist in the system - user must select from available models
      return {
        success: false,
        error: `Model "${modelId}" is not available. Please select from the available models.`,
      }
    }

    const modelUuid = aiModel.id

    // Find the Asset Insights Generator agent for this user by name
    const { data: agent, error: fetchError } = await supabase
      .from("ai_agents")
      .select("id")
      .eq("user_id", userId)
      .ilike("name", "%Asset Insights%")
      .maybeSingle()

    if (fetchError) {
      console.error("Error fetching agent:", fetchError)
      return { success: false, error: "Failed to fetch agent" }
    }

    if (!agent) {
      // Agent doesn't exist, create it for the user
      const { data: newAgent, error: createAgentError } = await supabase
        .from("ai_agents")
        .insert({
          name: "Asset Insights Generator",
          description: "AI-powered asset intelligence agent for generating insights, predictions, and recommendations",
          system_prompt: `You are an expert asset intelligence analyst specializing in enterprise asset management. 
Your role is to analyze asset data, predict maintenance needs, identify optimization opportunities, 
and provide actionable insights for asset lifecycle management. Focus on:
- Predictive maintenance recommendations
- Cost optimization strategies
- Utilization analysis and improvement
- Risk assessment and mitigation
- ESG and sustainability impact`,
          model_id: modelUuid,
          user_id: userId,
          parameters: { temperature: 0.4, max_tokens: 4096 },
          tools: ["asset_analysis", "predictive_maintenance", "cost_optimization"],
          is_active: true,
        })
        .select("id")
        .single()

      if (createAgentError || !newAgent) {
        console.error("Error creating Asset Insights agent:", createAgentError)
        return { success: false, error: "Failed to create Asset Insights agent" }
      }

      return { success: true, data: { agentId: newAgent.id, modelId } }
    }

    // Update the model reference
    const { error: updateError } = await supabase
      .from("ai_agents")
      .update({ model_id: modelUuid, updated_at: new Date().toISOString() })
      .eq("id", agent.id)

    if (updateError) {
      console.error("Error updating insights agent model:", updateError)
      return { success: false, error: updateError.message }
    }

    return { success: true, data: { agentId: agent.id, modelId } }
  } catch (error) {
    console.error("Error in updateInsightsAgentModel:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "An unexpected error occurred",
    }
  }
}

export async function deleteAgent(agentId: string) {
  const supabase = await createServerSupabaseClient()

  try {
    // Check if this is a system agent (protected from deletion)
    const { data: agent, error: fetchError } = await supabase
      .from("ai_agents")
      .select("is_system_agent")
      .eq("id", agentId)
      .single()

    if (fetchError) {
      console.error("Error fetching agent:", fetchError)
      return { success: false, error: fetchError.message }
    }

    if (agent?.is_system_agent) {
      return { success: false, error: "System agents cannot be deleted" }
    }

    const { error } = await supabase.from("ai_agents").delete().eq("id", agentId)

    if (error) {
      console.error("Error deleting agent:", error)
      return { success: false, error: error.message }
    }

    return { success: true }
  } catch (error) {
    console.error("Error in deleteAgent:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "An unexpected error occurred",
    }
  }
}

export async function executeWorkflow(workflowId: string, input: any) {
  const supabase = await createServerSupabaseClient()

  try {
    const { data: workflow, error: fetchError } = await supabase
      .from("ai_workflows")
      .select("*")
      .eq("id", workflowId)
      .single()

    if (fetchError || !workflow) {
      return { success: false, error: "Workflow not found" }
    }

    // Create execution record
    const { data: execution, error: execError } = await supabase
      .from("workflow_executions")
      .insert({
        workflow_id: workflowId,
        status: "running",
        input_data: input,
      })
      .select()
      .single()

    if (execError) {
      return { success: false, error: execError.message }
    }

    // Execute workflow logic here (simplified for now)
    const result = { output: "Workflow executed successfully", execution_id: execution.id }

    // Update execution status
    await supabase
      .from("workflow_executions")
      .update({
        status: "completed",
        output_data: result,
        completed_at: new Date().toISOString(),
      })
      .eq("id", execution.id)

    return { success: true, data: result }
  } catch (error) {
    console.error("Error in executeWorkflow:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "An unexpected error occurred",
    }
  }
}

// Agent Update Operations
export async function updateAgent(formData: {
  id: string
  user_id: string
  name?: string
  description?: string
  system_prompt?: string
  model_id?: string
  parameters?: Record<string, any>
  tools?: string[]
  is_active?: boolean
}) {
  const supabase = await createServerSupabaseClient()

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return { success: false, error: "User not authenticated" }
    }

    // Verify ownership
    const { data: existingAgent, error: fetchError } = await supabase
      .from("ai_agents")
      .select("id")
      .eq("id", formData.id)
      .eq("user_id", user.id)
      .single()

    if (fetchError || !existingAgent) {
      return { success: false, error: "Agent not found or access denied" }
    }

    // Build update object with only provided fields
    const updateData: Record<string, any> = {
      updated_at: new Date().toISOString(),
    }

    if (formData.name !== undefined) updateData.name = formData.name
    if (formData.description !== undefined) updateData.description = formData.description
    if (formData.system_prompt !== undefined) updateData.system_prompt = formData.system_prompt
    if (formData.model_id !== undefined) updateData.model_id = formData.model_id
    if (formData.parameters !== undefined) updateData.parameters = formData.parameters
    if (formData.tools !== undefined) updateData.tools = formData.tools
    if (formData.is_active !== undefined) updateData.is_active = formData.is_active

    const { data, error } = await supabase.from("ai_agents").update(updateData).eq("id", formData.id).select().single()

    if (error) {
      console.error("Error updating agent:", error)
      return { success: false, error: error.message }
    }

    revalidatePath("/ai-suite/asset-intelligence")
    return { success: true, data }
  } catch (error) {
    console.error("Error in updateAgent:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "An unexpected error occurred",
    }
  }
}
