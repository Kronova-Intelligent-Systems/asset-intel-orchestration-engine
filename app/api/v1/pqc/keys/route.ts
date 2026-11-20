/**
 * Kronova v1 post-quantum key registry.
 *
 * GET    lists the caller's registered public keys (requires read:agents)
 * POST   registers an ML-DSA-65 public key with a proof of possession (requires write:agents)
 * DELETE revokes a key: ?id=<key id> (requires write:agents)
 *
 * Once an account has an active key, every A2A and AetherNet message it sends must be signed.
 */

import type { NextRequest } from "next/server"
import { createAdminSupabaseClient } from "@/lib/supabase/admin"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { validateAPIAuth, apiError, apiSuccess } from "@/lib/auth/api-auth"
import { PUBLIC_KEY_BYTES, keyIdFor, parsePqcSignature } from "@/lib/pqc/envelope"
import { keyRegistrationBody } from "@/lib/pqc/sign"
import { verifyWithPublicKey } from "@/lib/pqc/service"

export const runtime = "nodejs"

const MAX_ACTIVE_KEYS = 10
const COLUMNS = "key_id, algorithm, label, created_at, revoked_at"
const BASE64 = /^[A-Za-z0-9+/]+={0,2}$/

async function clientFor(authMethod: "session" | "api_key") {
  return authMethod === "api_key" ? createAdminSupabaseClient() : await createServerSupabaseClient()
}

export async function GET(request: NextRequest) {
  try {
    const auth = await validateAPIAuth(request, ["read:agents"])
    if (!auth.authenticated) return apiError(auth.error || "Authentication failed", auth.status || 401)

    const supabase = await clientFor(auth.authMethod)
    const { data, error } = await supabase
      .from("pqc_public_keys")
      .select(COLUMNS)
      .eq("user_id", auth.userId!)
      .order("created_at", { ascending: false })
    if (error) return apiError("Failed to fetch keys", 500)
    return apiSuccess({ keys: data ?? [], signaturesRequired: (data ?? []).some((key) => !key.revoked_at) })
  } catch (error) {
    console.error("[PQC Keys API] GET error:", error)
    return apiError("Internal server error", 500)
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await validateAPIAuth(request, ["write:agents"])
    if (!auth.authenticated) return apiError(auth.error || "Authentication failed", auth.status || 401)

    let body: any
    try {
      body = await request.json()
    } catch {
      return apiError("Request body must be JSON", 400)
    }

    const publicKey = typeof body?.publicKey === "string" ? body.publicKey.trim() : ""
    if (!BASE64.test(publicKey)) return apiError("publicKey must be base64", 400)
    const bytes = new Uint8Array(Buffer.from(publicKey, "base64"))
    if (bytes.length !== PUBLIC_KEY_BYTES) {
      return apiError(`publicKey must be an ML-DSA-65 public key (${PUBLIC_KEY_BYTES} bytes)`, 400)
    }
    const label = typeof body?.label === "string" ? body.label.trim().slice(0, 120) || null : null

    const proof = parsePqcSignature(body?.proof)
    if (!proof) return apiError("proof is required: sign {publicKey} in the pqc.key-registration domain with the matching private key", 400)
    const keyId = keyIdFor(bytes)
    if (proof.keyId !== keyId) return apiError("proof.keyId does not match the public key", 400)
    if (!(await verifyWithPublicKey("pqc.key-registration", keyRegistrationBody(publicKey), proof, publicKey))) {
      return apiError("proof of possession is invalid or older than 5 minutes", 400)
    }

    const supabase = await clientFor(auth.authMethod)
    const { count } = await supabase
      .from("pqc_public_keys")
      .select("id", { count: "exact", head: true })
      .eq("user_id", auth.userId!)
      .is("revoked_at", null)
    if ((count ?? 0) >= MAX_ACTIVE_KEYS) return apiError(`Active key limit reached (${MAX_ACTIVE_KEYS}); revoke one first`, 409)

    const { data, error } = await supabase
      .from("pqc_public_keys")
      .insert({ user_id: auth.userId!, key_id: keyId, algorithm: "ML-DSA-65", public_key: publicKey, label })
      .select(COLUMNS)
      .single()
    if (error) {
      if (error.code === "23505") return apiError("This key is already registered", 409)
      console.error("[PQC Keys API] insert failed:", error.message)
      return apiError("Failed to register key", 500)
    }
    return apiSuccess({ key: data, signaturesRequired: true }, 201)
  } catch (error) {
    console.error("[PQC Keys API] POST error:", error)
    return apiError("Internal server error", 500)
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const auth = await validateAPIAuth(request, ["write:agents"])
    if (!auth.authenticated) return apiError(auth.error || "Authentication failed", auth.status || 401)

    const keyId = new URL(request.url).searchParams.get("id") ?? ""
    if (!/^pqc_[0-9a-f]{16}$/.test(keyId)) return apiError("id must be a key id such as pqc_0123456789abcdef", 400)

    const supabase = await clientFor(auth.authMethod)
    const { data, error } = await supabase
      .from("pqc_public_keys")
      .update({ revoked_at: new Date().toISOString() })
      .eq("user_id", auth.userId!)
      .eq("key_id", keyId)
      .is("revoked_at", null)
      .select(COLUMNS)
      .maybeSingle()
    if (error) return apiError("Failed to revoke key", 500)
    if (!data) return apiError("No active key with that id", 404)
    return apiSuccess({ key: data })
  } catch (error) {
    console.error("[PQC Keys API] DELETE error:", error)
    return apiError("Internal server error", 500)
  }
}
