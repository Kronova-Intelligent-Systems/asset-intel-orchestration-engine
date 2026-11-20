/**
 * Verification and attestation for Kronova messages.
 *
 * Sender signatures: a caller signs a message with a private key that never
 * leaves their machine. Kronova verifies it against a public key the same
 * account registered in pqc_public_keys. A stolen API key alone cannot forge
 * one, which is the point of adding it on top of bearer auth.
 *
 * Platform attestations: when PQC_PLATFORM_PRIVATE_KEY and PQC_PLATFORM_PUBLIC_KEY
 * are set, Kronova countersigns what it records, so a recipient can prove the
 * record came from this platform. Without them, attestations are simply absent.
 */

import type { SupabaseClient } from "@supabase/supabase-js"
import { signDetached, verifyDetached } from "./crypto"
import {
  PQC_ALG,
  PRIVATE_KEY_BYTES,
  PUBLIC_KEY_BYTES,
  isFresh,
  keyIdFor,
  parsePqcSignature,
  signingBytes,
  type PqcDomain,
  type PqcSignature,
} from "./envelope"

export class PqcError extends Error {
  constructor(
    message: string,
    public readonly code: string,
  ) {
    super(message)
    this.name = "PqcError"
  }
}

export type SenderVerification =
  | { status: "unsigned" }
  | { status: "verified"; keyId: string; alg: typeof PQC_ALG; signedAt: string; signature: string }

/** Deployment-wide switch: reject every unsigned message. */
export function signaturesRequiredByEnv(): boolean {
  return process.env.PQC_REQUIRE_SIGNATURES === "true"
}

async function loadActiveKey(supabase: SupabaseClient, userId: string, keyId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from("pqc_public_keys")
    .select("public_key")
    .eq("user_id", userId)
    .eq("key_id", keyId)
    .is("revoked_at", null)
    .maybeSingle()
  if (error) throw new PqcError("Could not look up signing keys", "PQC_KEY_LOOKUP_FAILED")
  return data?.public_key ?? null
}

async function hasActiveKeys(supabase: SupabaseClient, userId: string): Promise<boolean> {
  const { count, error } = await supabase
    .from("pqc_public_keys")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .is("revoked_at", null)
  if (error) throw new PqcError("Could not look up signing keys", "PQC_KEY_LOOKUP_FAILED")
  return (count ?? 0) > 0
}

/** Checks alg, freshness and the signature itself against one known public key. */
export async function verifyWithPublicKey(
  domain: PqcDomain,
  body: unknown,
  signature: PqcSignature,
  publicKeyB64: string,
): Promise<boolean> {
  if (!isFresh(signature.signedAt)) return false
  if (keyIdFor(new Uint8Array(Buffer.from(publicKeyB64, "base64"))) !== signature.keyId) return false
  return verifyDetached(signature.signature, signingBytes(domain, signature.keyId, signature.signedAt, body), publicKeyB64)
}

/**
 * Verifies the sender's signature on `body`.
 * - No signature: accepted as "unsigned" unless the deployment or the account requires signing.
 *   An account that has registered a key must sign everything, so a stolen API key cannot downgrade it.
 * - A signature that is present must be valid, or the request is rejected.
 */
export async function verifySender(opts: {
  supabase: SupabaseClient
  userId: string
  domain: PqcDomain
  body: unknown
  signature: unknown
}): Promise<SenderVerification> {
  const { supabase, userId, domain, body, signature: raw } = opts

  if (raw === undefined || raw === null) {
    if (signaturesRequiredByEnv() || (await hasActiveKeys(supabase, userId))) {
      throw new PqcError("A post-quantum signature is required for this account", "PQC_SIGNATURE_REQUIRED")
    }
    return { status: "unsigned" }
  }

  const signature = parsePqcSignature(raw)
  if (!signature) {
    throw new PqcError("Malformed post-quantum signature (expected alg, keyId, signedAt, signature)", "PQC_SIGNATURE_MALFORMED")
  }
  if (!isFresh(signature.signedAt)) {
    throw new PqcError("Signature is outside the 5 minute freshness window", "PQC_SIGNATURE_STALE")
  }
  const publicKey = await loadActiveKey(supabase, userId, signature.keyId)
  if (!publicKey) {
    throw new PqcError("Signing key is not registered for this account or has been revoked", "PQC_KEY_UNKNOWN")
  }
  if (!(await verifyWithPublicKey(domain, body, signature, publicKey))) {
    throw new PqcError("Post-quantum signature does not match the message", "PQC_SIGNATURE_INVALID")
  }
  return { status: "verified", keyId: signature.keyId, alg: signature.alg, signedAt: signature.signedAt, signature: signature.signature }
}

// ---------------------------------------------------------------------------
// Platform key
// ---------------------------------------------------------------------------

export interface PlatformKeyInfo {
  keyId: string
  publicKey: string
}

export function getPlatformKeyInfo(): PlatformKeyInfo | null {
  const publicKey = process.env.PQC_PLATFORM_PUBLIC_KEY?.trim()
  const privateKey = process.env.PQC_PLATFORM_PRIVATE_KEY?.trim()
  if (!publicKey || !privateKey) return null
  const bytes = new Uint8Array(Buffer.from(publicKey, "base64"))
  if (bytes.length !== PUBLIC_KEY_BYTES) return null
  if (Buffer.from(privateKey, "base64").length !== PRIVATE_KEY_BYTES) {
    console.error(
      "[PQC] PQC_PLATFORM_PRIVATE_KEY is not an ML-DSA-65 secret key (expected 4032 bytes). Keys from aethernet-pqc-sdk 0.2.1 or earlier must be regenerated. Attestations are disabled.",
    )
    return null
  }
  return { keyId: keyIdFor(bytes), publicKey }
}

/** Countersigns `body` as the platform. Returns null when no platform key is configured or signing fails. */
export async function attest(domain: PqcDomain, body: unknown): Promise<PqcSignature | null> {
  const info = getPlatformKeyInfo()
  if (!info) return null
  try {
    const signedAt = new Date().toISOString()
    const signature = await signDetached(
      signingBytes(domain, info.keyId, signedAt, body),
      process.env.PQC_PLATFORM_PRIVATE_KEY!.trim(),
    )
    return { alg: PQC_ALG, keyId: info.keyId, signedAt, signature }
  } catch (error) {
    console.error("[PQC] Platform attestation failed:", error instanceof Error ? error.message : error)
    return null
  }
}

/** Verifies a platform attestation against the configured platform public key. */
export async function verifyAttestation(domain: PqcDomain, body: unknown, signature: PqcSignature): Promise<boolean> {
  const info = getPlatformKeyInfo()
  if (!info || info.keyId !== signature.keyId) return false
  return verifyWithPublicKey(domain, body, signature, info.publicKey)
}
