#!/usr/bin/env node
/**
 * Generates an ML-DSA-65 keypair for Kronova post-quantum signing.
 *
 *   node scripts/pqc-keygen.mjs
 *
 * The private key is written to ./kronova-pqc-<keyId>.key.json (mode 0600) and is
 * never printed. The script prints the registration request body, which holds
 * only the public key and a proof of possession (valid for 5 minutes):
 *
 *   curl -X POST https://app.kronova.io/api/v1/pqc/keys \
 *     -H "Authorization: Bearer $KRONOVA_API_KEY" -H "Content-Type: application/json" \
 *     -d @registration.json
 *
 * For the platform key, set PQC_PLATFORM_PUBLIC_KEY and PQC_PLATFORM_PRIVATE_KEY
 * from the key file in your deployment environment, and do not register it.
 */

import { createHash } from "node:crypto"
import { writeFileSync } from "node:fs"
import { createRequire } from "node:module"

const require = createRequire(import.meta.url)
const pqc = require("@kronova-intelligent-systems/aethernet-pqc-sdk")

// Keep in step with lib/pqc/envelope.ts; the test suite checks both produce identical bytes.
function canonicalJson(value) {
  if (value === null) return "null"
  if (Array.isArray(value)) return `[${value.map((v) => (v === undefined ? "null" : canonicalJson(v))).join(",")}]`
  if (typeof value === "object") {
    return `{${Object.entries(value)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`)
      .join(",")}}`
  }
  return JSON.stringify(value)
}

const pair = pqc.generate_pqc_keypair()
const publicKey = pair.public_key_b64
const privateKey = pair.private_key_b64
pair.free()

const keyId = `pqc_${createHash("sha256").update(Buffer.from(publicKey, "base64")).digest("hex").slice(0, 16)}`
const signedAt = new Date().toISOString()
const bytes = new TextEncoder().encode(
  `kronova-pqc/v1\npqc.key-registration\n${keyId}\n${signedAt}\n${canonicalJson({ publicKey })}`,
)
const signature = Buffer.from(pqc.sign_pqc_payload(bytes, Buffer.from(privateKey, "base64"))).toString("base64")

const keyFile = `kronova-pqc-${keyId}.key.json`
writeFileSync(keyFile, JSON.stringify({ keyId, algorithm: "ML-DSA-65", publicKey, privateKey }, null, 2), { mode: 0o600 })

writeFileSync(
  "registration.json",
  JSON.stringify({ publicKey, label: "my signing key", proof: { alg: "ML-DSA-65", keyId, signedAt, signature } }, null, 2),
)

console.log(`Key id:            ${keyId}`)
console.log(`Private key file:  ${keyFile}  (keep secret, never commit)`)
console.log("Registration body: registration.json  (public key + proof, valid for 5 minutes)")
