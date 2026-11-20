/** DELETE removes a data store from the caller's inventory. Requires write:assets. */

import type { NextRequest } from "next/server"
import { createAdminSupabaseClient } from "@/lib/supabase/admin"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { validateAPIAuth, apiError, apiSuccess } from "@/lib/auth/api-auth"

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await validateAPIAuth(request, ["write:assets"])
    if (!auth.authenticated) return apiError(auth.error || "Authentication failed", auth.status || 401)

    const { id } = await params
    if (!UUID.test(id)) return apiError("Invalid data store id", 400)

    const supabase = auth.authMethod === "api_key" ? createAdminSupabaseClient() : await createServerSupabaseClient()
    const { data, error } = await supabase
      .from("data_stores")
      .delete()
      .eq("id", id)
      .eq("user_id", auth.userId!)
      .select("id")
      .maybeSingle()

    if (error) return apiError("Failed to delete data store", 500)
    if (!data) return apiError("Data store not found", 404)
    return apiSuccess({ deleted: data.id })
  } catch (error) {
    console.error("[Data Stores API] DELETE error:", error)
    return apiError("Internal server error", 500)
  }
}
