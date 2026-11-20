/**
 * Thin server-side wrapper over @kronova-intelligent-systems/aethernet-pqc-sdk
 * (NIST FIPS 204 ML-DSA-65, compiled to WebAssembly). Loaded lazily so routes that
 * never touch signatures pay no WASM start-up cost.
 */

import { PUBLIC_KEY_BYTES, SIGNATURE_BYTES } from "./envelope"

type PqcModule = typeof import("@kronova-intelligent-systems/aethernet-pqc-sdk")

let loading: Promise<PqcModule> | undefined

export function loadPqc(): Promise<PqcModule> {
  if (!loading) {
    loading = import("@kronova-intelligent-systems/aethernet-pqc-sdk")
      .then((mod: any) => (typeof mod.verify_pqc_signature === "function" ? mod : mod.default) as PqcModule)
      .catch((error) => {
        loading = undefined
        throw error
      })
  }
  return loading
}

const fromBase64 = (value: string) => new Uint8Array(Buffer.from(value, "base64"))

/** Never throws: malformed keys, wrong lengths and WASM errors all mean "not valid". */
export async function verifyDetached(signatureB64: string, message: Uint8Array, publicKeyB64: string): Promise<boolean> {
  const signature = fromBase64(signatureB64)
  const publicKey = fromBase64(publicKeyB64)
  if (signature.length !== SIGNATURE_BYTES || publicKey.length !== PUBLIC_KEY_BYTES) return false
  try {
    const pqc = await loadPqc()
    return pqc.verify_pqc_signature(signature, message, publicKey)
  } catch {
    return false
  }
}

export async function signDetached(message: Uint8Array, privateKeyB64: string): Promise<string> {
  const pqc = await loadPqc()
  return Buffer.from(pqc.sign_pqc_payload(message, fromBase64(privateKeyB64))).toString("base64")
}

export async function generateKeypair(): Promise<{ publicKey: string; privateKey: string }> {
  const pqc = await loadPqc()
  const pair = pqc.generate_pqc_keypair()
  try {
    return { publicKey: pair.public_key_b64, privateKey: pair.private_key_b64 }
  } finally {
    pair.free()
  }
}
