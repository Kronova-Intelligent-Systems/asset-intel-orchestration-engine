/**
 * Kronova v1 Assets API
 */

import { type NextRequest, after } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { triggerWebhooks } from "@/lib/webhooks/webhook-delivery"
import { validateAPIAuth, apiError, apiSuccess } from "@/lib/auth/api-auth"

export async function GET(request: NextRequest) {
  try {
    const auth = await validateAPIAuth(request, ["read:assets"])

    if (!auth.authenticated) {
      return apiError(auth.error || "Authentication failed", auth.status || 401)
    }

    const supabase = await createServerSupabaseClient()
    const { searchParams } = new URL(request.url)

    const limit = Math.min(Number.parseInt(searchParams.get("limit") || "50"), 100)
    const offset = Number.parseInt(searchParams.get("offset") || "0")
    const type = searchParams.get("type")
    const status = searchParams.get("status")

    let query = supabase
      .from("assets")
      .select("*", { count: "exact" })
      .eq("user_id", auth.userId!)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1)

    if (type) query = query.eq("asset_type", type)
    if (status) query = query.eq("status", status)

    const { data, error, count } = await query

    if (error) {
      return apiError("Failed to fetch assets", 500)
    }

    return apiSuccess({
      assets: data || [],
      pagination: {
        total: count || 0,
        limit,
        offset,
        hasMore: (count || 0) > offset + limit,
      },
    })
  } catch (error) {
    console.error("[Assets API] Error:", error)
    return apiError("Internal server error", 500)
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await validateAPIAuth(request, ["write:assets"])

    if (!auth.authenticated) {
      return apiError(auth.error || "Authentication failed", auth.status || 401)
    }

    const body = await request.json()
    const {
      name,
      assetId,
      assetType,
      description,
      status = "active",
      purchaseCost,
      currentValue,
      location,
      specifications,
      esgMetrics,
      iotSensorId,
      metadata = {},
    } = body

    if (!name || !assetType) {
      return apiError("Missing required fields: name, assetType", 400)
    }

    const supabase = await createServerSupabaseClient()

    const { data, error } = await supabase
      .from("assets")
      .insert({
        name,
        asset_id: assetId || `AST-${Date.now()}`,
        asset_type: assetType,
        description,
        status,
        purchase_cost: purchaseCost,
        current_value: currentValue,
        location,
        specifications,
        esg_metrics: esgMetrics,
        iot_sensor_id: iotSensorId,
        metadata,
        user_id: auth.userId,
      })
      .select()
      .single()

    if (error) {
      return apiError("Failed to create asset", 500)
    }

    after(() =>
      triggerWebhooks({
        userId: auth.userId!,
        event: "asset.created",
        payload: {
          assetId: data.id,
          assetTag: data.asset_id,
          name: data.name,
          assetType: data.asset_type,
          status: data.status,
          timestamp: new Date().toISOString(),
        },
      }),
    )

    return apiSuccess(data, 201)
  } catch (error) {
    console.error("[Assets API] Error:", error)
    return apiError("Internal server error", 500)
  }
}
