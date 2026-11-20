/**
 * Kronova post-quantum signature envelope (kronova-pqc/v1).
 *
 * A signature covers domain-separated bytes:
 *   kronova-pqc/v1 \n <domain> \n <keyId> \n <signedAt> \n <canonical JSON of body>
 *
 * Canonical JSON: object keys sorted by UTF-16 code unit, no whitespace,
 * `undefined` members omitted, arrays keep their order. Clients in other
 * languages must produce the same bytes.
 */

import { createHash } from "node:crypto"

export const PQC_ALG = "ML-DSA-65"
export const PQC_SPEC = "kronova-pqc/v1"
export const PUBLIC_KEY_BYTES = 1952
// FIPS 204 ML-DSA-65 sizes, measured from @kronova-intelligent-systems/aethernet-pqc-sdk@0.2.2:
// 1952-byte public key, 4032-byte secret key, 3309-byte signature. Keys and signatures from 0.2.1 and
// earlier (CRYSTALS-Dilithium3 round 3, 3293-byte signatures) are not wire-compatible and must be regenerated.
export const SIGNATURE_BYTES = 3309
export const PRIVATE_KEY_BYTES = 4032
export const MAX_CLOCK_SKEW_MS = 5 * 60 * 1000

export type PqcDomain =
  | "a2a.message"
  | "aethernet.message"
  | "aethernet.attestation"
  | "a2a.aethernet.bridge"
  | "pqc.key-registration"
  | "model-ops.plan"

export interface PqcSignature {
  alg: typeof PQC_ALG
  keyId: string
  signedAt: string
  /** Base64 detached signature (3309 bytes, see SIGNATURE_BYTES) */
  signature: string
}

export function canonicalJson(value: unknown): string {
  if (value === null) return "null"
  switch (typeof value) {
    case "string":
    case "boolean":
      return JSON.stringify(value)
    case "number":
      if (!Number.isFinite(value)) throw new TypeError("Cannot canonicalize a non-finite number")
      return JSON.stringify(value)
    case "object": {
      if (Array.isArray(value)) {
        return `[${value.map((item) => (item === undefined ? "null" : canonicalJson(item))).join(",")}]`
      }
      const entries = Object.entries(value as Record<string, unknown>)
        .filter(([, member]) => member !== undefined)
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
        .map(([key, member]) => `${JSON.stringify(key)}:${canonicalJson(member)}`)
      return `{${entries.join(",")}}`
    }
    default:
      throw new TypeError(`Cannot canonicalize a value of type ${typeof value}`)
  }
}

export function signingBytes(domain: PqcDomain, keyId: string, signedAt: string, body: unknown): Uint8Array {
  return new TextEncoder().encode(`${PQC_SPEC}\n${domain}\n${keyId}\n${signedAt}\n${canonicalJson(body)}`)
}

/** Stable identifier derived from the public key: pqc_ + first 16 hex chars of its SHA-256 */
export function keyIdFor(publicKey: Uint8Array): string {
  return `pqc_${createHash("sha256").update(publicKey).digest("hex").slice(0, 16)}`
}

const BASE64 = /^[A-Za-z0-9+/]+={0,2}$/

export function parsePqcSignature(raw: unknown): PqcSignature | null {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return null
  const { alg, keyId, signedAt, signature } = raw as Record<string, unknown>
  if (alg !== PQC_ALG) return null
  if (typeof keyId !== "string" || !/^pqc_[0-9a-f]{16}$/.test(keyId)) return null
  if (typeof signedAt !== "string" || Number.isNaN(Date.parse(signedAt))) return null
  if (typeof signature !== "string" || signature.length > 4600 || !BASE64.test(signature)) return null
  return { alg, keyId, signedAt, signature }
}

export function isFresh(signedAt: string, now = Date.now()): boolean {
  return Math.abs(now - Date.parse(signedAt)) <= MAX_CLOCK_SKEW_MS
}
