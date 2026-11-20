/**
 * Public, unauthenticated: the platform's ML-DSA-65 public key and the signing spec,
 * so recipients can verify Kronova attestations and clients can sign for Kronova.
 */

import { NextResponse } from "next/server"
import { getPlatformKeyInfo } from "@/lib/pqc/service"
import { MAX_CLOCK_SKEW_MS, PQC_ALG, PQC_SPEC, PUBLIC_KEY_BYTES, SIGNATURE_BYTES } from "@/lib/pqc/envelope"

export const runtime = "nodejs"

export async function GET() {
  const info = getPlatformKeyInfo()
  return NextResponse.json(
    {
      spec: PQC_SPEC,
      algorithm: PQC_ALG,
      standard: "NIST FIPS 204 (ML-DSA-65)",
      implementation: "@kronova-intelligent-systems/aethernet-pqc-sdk 0.2.2 (pure Rust compiled to WebAssembly). Verify with the same SDK.",
      publicKeyBytes: PUBLIC_KEY_BYTES,
      signatureBytes: SIGNATURE_BYTES,
      freshnessWindowSeconds: MAX_CLOCK_SKEW_MS / 1000,
      attestationsEnabled: Boolean(info),
      platformKey: info ? { keyId: info.keyId, publicKey: info.publicKey } : null,
      signedBytes: `${PQC_SPEC}\\n<domain>\\n<keyId>\\n<signedAt>\\n<canonical JSON of body>`,
      canonicalJson: "Object keys sorted by UTF-16 code unit, no whitespace, undefined members omitted, arrays keep order.",
      domains: {
        "a2a.message": "Sender signature on an A2A message: {messageId, role, parts, contextId|null, referenceTaskIds}. Carried in message.metadata.pqcSignature.",
        "aethernet.message": "Sender signature on an AetherNet message: {sourceAgentId, targetAgentId, messageType, payload}.",
        "aethernet.attestation": "Platform countersignature over a recorded AetherNet message.",
        "a2a.aethernet.bridge": "Platform countersignature over an A2A message bridged through AetherNet.",
        "pqc.key-registration": "Proof of possession when registering a public key: {publicKey}.",
      },
    },
    { headers: { "Cache-Control": "public, max-age=300" } },
  )
}
