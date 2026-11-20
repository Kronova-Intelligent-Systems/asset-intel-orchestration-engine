import * as nodeCrypto from "node:crypto"
import type { KeyObject } from "node:crypto"
import { generateKeypair, signDetached } from "@/lib/pqc/crypto"
import { canonicalJson, keyIdFor, signingBytes, PQC_ALG, type PqcDomain, type PqcSignature } from "@/lib/pqc/envelope"
import { verifyWithPublicKey } from "@/lib/pqc/service"
import type { ActorId } from "./types"

// Node 24 ships ML-KEM, but @types/node 22 has no typings for it yet.
const kem = nodeCrypto as unknown as {
  generateKeyPairSync(type: "ml-kem-1024"): { publicKey: KeyObject; privateKey: KeyObject }
  encapsulate(key: KeyObject): { ciphertext: Buffer; sharedKey: Buffer }
  decapsulate(key: KeyObject, ciphertext: Buffer): Buffer
}

export const KEM_ALG = "ML-KEM-1024"
const HKDF_INFO = "aethernet-e2ee/1"

export interface Identity {
  id: ActorId
  label: string
  keyId: string
  dsaPublic: string
  dsaPrivate: string
  kemPublic: KeyObject
  kemPrivate: KeyObject
}

export async function createIdentity(id: ActorId, label: string): Promise<Identity> {
  const { publicKey, privateKey } = await generateKeypair()
  const keyId = keyIdFor(new Uint8Array(Buffer.from(publicKey, "base64")))
  const pair = kem.generateKeyPairSync("ml-kem-1024")
  return { id, label, keyId, dsaPublic: publicKey, dsaPrivate: privateKey, kemPublic: pair.publicKey, kemPrivate: pair.privateKey }
}

export async function signBody(identity: Identity, domain: PqcDomain, body: unknown): Promise<PqcSignature> {
  const signedAt = new Date().toISOString()
  const signature = await signDetached(signingBytes(domain, identity.keyId, signedAt, body), identity.dsaPrivate)
  return { alg: PQC_ALG, keyId: identity.keyId, signedAt, signature }
}

export async function verifyBody(
  publicKey: string,
  domain: PqcDomain,
  body: unknown,
  signature: PqcSignature,
): Promise<boolean> {
  return verifyWithPublicKey(domain, body, signature, publicKey)
}

export interface Envelope {
  v: "aethernet-e2ee/1"
  from: string
  to: string
  kem: typeof KEM_ALG
  kemCiphertext: string
  cipher: "AES-256-GCM"
  iv: string
  ciphertext: string
  tag: string
}

export interface SealedMessage {
  envelope: Envelope
  header: { envelopeDigest: string; from: string; to: string; signature: PqcSignature }
}

export function sha256Hex(value: string | Uint8Array): string {
  return nodeCrypto.createHash("sha256").update(value).digest("hex")
}

function envelopeDigest(envelope: Envelope): string {
  return sha256Hex(canonicalJson(envelope))
}

function deriveKey(sharedKey: Buffer): Buffer {
  return Buffer.from(nodeCrypto.hkdfSync("sha256", sharedKey, Buffer.alloc(0), HKDF_INFO, 32))
}

/** Seal a plaintext for one recipient: ML-KEM-1024 encapsulation, AES-256-GCM payload, ML-DSA-signed routing header. */
export async function seal(sender: Identity, recipient: Identity, plaintext: unknown): Promise<SealedMessage> {
  const { ciphertext: kemCiphertext, sharedKey } = kem.encapsulate(recipient.kemPublic)
  const iv = nodeCrypto.randomBytes(12)
  const cipher = nodeCrypto.createCipheriv("aes-256-gcm", deriveKey(sharedKey), iv)
  cipher.setAAD(Buffer.from(`${sender.keyId}>${recipient.keyId}`))
  const ciphertext = Buffer.concat([cipher.update(canonicalJson(plaintext), "utf8"), cipher.final()])

  const envelope: Envelope = {
    v: "aethernet-e2ee/1",
    from: sender.keyId,
    to: recipient.keyId,
    kem: KEM_ALG,
    kemCiphertext: kemCiphertext.toString("base64"),
    cipher: "AES-256-GCM",
    iv: iv.toString("base64"),
    ciphertext: ciphertext.toString("base64"),
    tag: cipher.getAuthTag().toString("base64"),
  }
  const digest = envelopeDigest(envelope)
  const header = { envelopeDigest: digest, from: sender.keyId, to: recipient.keyId }
  return { envelope, header: { ...header, signature: await signBody(sender, "aethernet.message", header) } }
}

export type GatewayVerdict = { ok: true; digest: string } | { ok: false; reason: string }

/** The blind edge proxy: sees only the envelope and its signed header, never plaintext. */
export async function gatewayVerify(sealed: SealedMessage, senderPublicKey: string): Promise<GatewayVerdict> {
  const digest = envelopeDigest(sealed.envelope)
  if (digest !== sealed.header.envelopeDigest) {
    return { ok: false, reason: "Envelope digest does not match the signed header: ciphertext was modified in transit" }
  }
  const { signature, ...signedBody } = sealed.header
  const valid = await verifyBody(senderPublicKey, "aethernet.message", signedBody, signature)
  return valid ? { ok: true, digest } : { ok: false, reason: "ML-DSA signature on the routing header is invalid" }
}

export function open<T>(recipient: Identity, envelope: Envelope): { ok: true; value: T } | { ok: false; reason: string } {
  try {
    const sharedKey = kem.decapsulate(recipient.kemPrivate, Buffer.from(envelope.kemCiphertext, "base64"))
    const decipher = nodeCrypto.createDecipheriv(
      "aes-256-gcm",
      deriveKey(sharedKey),
      Buffer.from(envelope.iv, "base64"),
    )
    decipher.setAAD(Buffer.from(`${envelope.from}>${envelope.to}`))
    decipher.setAuthTag(Buffer.from(envelope.tag, "base64"))
    const plain = Buffer.concat([decipher.update(Buffer.from(envelope.ciphertext, "base64")), decipher.final()])
    return { ok: true, value: JSON.parse(plain.toString("utf8")) as T }
  } catch {
    return { ok: false, reason: "AES-256-GCM authentication tag mismatch: payload rejected" }
  }
}

/** Flip one byte of the ciphertext, as an on-path attacker would. */
export function tamperWith(sealed: SealedMessage): SealedMessage {
  const bytes = Buffer.from(sealed.envelope.ciphertext, "base64")
  bytes[Math.floor(bytes.length / 2)] ^= 0x01
  return { ...sealed, envelope: { ...sealed.envelope, ciphertext: bytes.toString("base64") } }
}

export function hexPreview(base64: string, bytes = 20): string {
  const hex = Buffer.from(base64, "base64").subarray(0, bytes).toString("hex")
  return `${hex.match(/.{1,2}/g)?.join(" ") ?? ""} …`
}

export function byteLength(base64: string): number {
  return Buffer.from(base64, "base64").length
}

export function shortKey(keyId: string): string {
  return keyId.replace("pqc_", "").slice(0, 8)
}
