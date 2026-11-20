/**
 * Kronova v1 Data Stores API: the inventory behind data_sovereignty_manager.
 *
 * GET  lists the caller's stores (requires read:assets)
 * POST creates or updates a store by name and refreshes last_verified_at (requires write:assets)
 */

import type { NextRequest } from "next/server"
import { createAdminSupabaseClient } from "@/lib/supabase/admin"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { validateAPIAuth, apiError, apiSuccess } from "@/lib/auth/api-auth"

const STORE_TYPES = ["database", "object_storage", "file_share", "saas", "backup", "analytics", "other"]
const CLASSIFICATIONS = ["public", "internal", "confidential", "restricted"]
const TRANSFER_MECHANISMS = ["adequacy", "scc", "bcr", "consent", "none"]
const MAX_STORES_PER_USER = 500
const COLUMNS =
  "id, name, store_type, provider, region, jurisdiction, data_classification, contains_personal_data, transfer_mechanism, last_verified_at, created_at"

async function clientFor(authMethod: "session" | "api_key") {
  return authMethod === "api_key" ? createAdminSupabaseClient() : await createServerSupabaseClient()
}

export async function GET(request: NextRequest) {
  try {
    const auth = await validateAPIAuth(request, ["read:assets"])
    if (!auth.authenticated) return apiError(auth.error || "Authentication failed", auth.status || 401)

    const supabase = await clientFor(auth.authMethod)
    const { data, error } = await supabase
      .from("data_stores")
      .select(COLUMNS)
      .eq("user_id", auth.userId!)
      .order("created_at", { ascending: false })
      .limit(MAX_STORES_PER_USER)
    if (error) return apiError("Failed to fetch data stores", 500)
    return apiSuccess({ dataStores: data ?? [] })
  } catch (error) {
    console.error("[Data Stores API] GET error:", error)
    return apiError("Internal server error", 500)
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await validateAPIAuth(request, ["write:assets"])
    if (!auth.authenticated) return apiError(auth.error || "Authentication failed", auth.status || 401)

    let body: any
    try {
      body = await request.json()
    } catch {
      return apiError("Request body must be JSON", 400)
    }

    const name = typeof body?.name === "string" ? body.name.trim() : ""
    const jurisdiction = typeof body?.jurisdiction === "string" ? body.jurisdiction.trim().toUpperCase() : ""
    const classification = body?.dataClassification ?? body?.data_classification
    const storeType = body?.storeType ?? body?.store_type ?? "database"
    const personal = body?.containsPersonalData ?? body?.contains_personal_data ?? false
    const transfer = body?.transferMechanism ?? body?.transfer_mechanism ?? null

    if (name.length < 1 || name.length > 120) return apiError("name must be 1-120 characters", 400)
    if (!/^[A-Z]{2}$/.test(jurisdiction)) return apiError("jurisdiction must be a two-letter country code (use EU for EU-wide)", 400)
    if (!CLASSIFICATIONS.includes(classification)) return apiError(`dataClassification must be one of: ${CLASSIFICATIONS.join(", ")}`, 400)
    if (!STORE_TYPES.includes(storeType)) return apiError(`storeType must be one of: ${STORE_TYPES.join(", ")}`, 400)
    if (typeof personal !== "boolean") return apiError("containsPersonalData must be a boolean", 400)
    if (transfer !== null && !TRANSFER_MECHANISMS.includes(transfer)) {
      return apiError(`transferMechanism must be one of: ${TRANSFER_MECHANISMS.join(", ")}`, 400)
    }
    const provider = typeof body?.provider === "string" ? body.provider.trim().slice(0, 120) || null : null
    const region = typeof body?.region === "string" ? body.region.trim().slice(0, 120) || null : null

    const supabase = await clientFor(auth.authMethod)

    const { count } = await supabase
      .from("data_stores")
      .select("id", { count: "exact", head: true })
      .eq("user_id", auth.userId!)
    const { data: existing } = await supabase
      .from("data_stores")
      .select("id")
      .eq("user_id", auth.userId!)
      .eq("name", name)
      .maybeSingle()
    if (!existing && (count ?? 0) >= MAX_STORES_PER_USER) {
      return apiError(`Data store limit reached (${MAX_STORES_PER_USER})`, 409)
    }

    const { data, error } = await supabase
      .from("data_stores")
      .upsert(
        {
          user_id: auth.userId!,
          name,
          store_type: storeType,
          provider,
          region,
          jurisdiction,
          data_classification: classification,
          contains_personal_data: personal,
          transfer_mechanism: transfer,
          last_verified_at: new Date().toISOString(),
        },
        { onConflict: "user_id,name" },
      )
      .select(COLUMNS)
      .single()
    if (error) {
      console.error("[Data Stores API] upsert failed:", error.message)
      return apiError("Failed to save data store", 500)
    }
    return apiSuccess({ dataStore: data }, existing ? 200 : 201)
  } catch (error) {
    console.error("[Data Stores API] POST error:", error)
    return apiError("Internal server error", 500)
  }
}
