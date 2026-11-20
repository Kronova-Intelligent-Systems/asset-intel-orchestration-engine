import { createPublicKey } from "node:crypto"
import type { Envelope, Identity, SealedMessage } from "./crypto"
import type { KvsResult } from "./kvs"
import type { StepCheck } from "./types"

/**
 * Engine seam for the settlement demo.
 *
 * "standin" runs the open-source QUAS and KVS stand-ins in this server process.
 * "aethernet" talks to the AetherNet edge gateway at AETHERNET_BASE_URL, which a pilot partner is given during
 * onboarding. The gateway is the only public AetherNet surface: QUAS runs inside a private enclave network and KVS runs
 * airgapped behind it, so neither has a public API URL and this app never addresses them directly. There is deliberately
 * no default URL: without AETHERNET_BASE_URL the engine is unavailable and runs use the stand-ins.
 *
 * The wire contract below is the integration surface this app expects the gateway to expose on behalf of QUAS and KVS.
 * It is defined here, in one place, so it can be reconciled with the gateway's real API without touching the run pipeline.
 *
 *   GET  /healthz                                   -> 200 when the gateway and enclave are serving
 *   GET  /v1/quas/identity                          -> { keyId, dsaPublic, kemPublic, attestation? }
 *   POST /v1/kvs/lookup    { query }                -> { score, neighbors[], dimensions, model, attestation? }
 *   POST /v1/quas/enforce  { envelope, header, publicKeys, counterpartyScore }
 *                                                   -> { pass, checks[], commandSignature?, attestation? }
 *
 * dsaPublic is a base64 FIPS 204 ML-DSA-65 public key. kemPublic is a base64 SPKI DER ML-KEM-1024 (FIPS 203) public key.
 * Requests carry `Authorization: Bearer ${AETHER_API_KEY}`.
 */

const BASE_URL = (process.env.AETHERNET_BASE_URL ?? "").trim().replace(/\/$/, "")
const REQUEST_TIMEOUT_MS = 20_000
const HEALTH_TTL_MS = 15_000

let healthCache: { at: number; ok: boolean } | null = null

function authHeaders(): Record<string, string> {
  const key = process.env.AETHER_API_KEY
  return { "Content-Type": "application/json", ...(key ? { Authorization: `Bearer ${key}` } : {}) }
}

/** The kill switch: nothing routes to the pods until this is set to "true". */
export function aethernetLiveEnabled(): boolean {
  return process.env.AETHERNET_LIVE_ENABLED === "true"
}

async function aethernetReachable(): Promise<boolean> {
  if (!BASE_URL) return false
  if (healthCache && Date.now() - healthCache.at < HEALTH_TTL_MS) return healthCache.ok
  let ok = false
  try {
    const response = await fetch(`${BASE_URL}/healthz`, { headers: authHeaders(), signal: AbortSignal.timeout(2_500), cache: "no-store" })
    ok = response.ok
  } catch {
    ok = false
  }
  healthCache = { at: Date.now(), ok }
  return ok
}

/**
 * Pilot partners are listed by user id or email in AETHERNET_PILOT_ALLOWLIST (comma separated).
 * An entry of "*" opens the engine to every signed-in user, for internal demos.
 */
function isPilotPartner(user: { id: string; email?: string | null }): boolean {
  const entries = (process.env.AETHERNET_PILOT_ALLOWLIST ?? "")
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean)
  if (entries.includes("*")) return true
  return entries.includes(user.id.toLowerCase()) || (user.email ? entries.includes(user.email.toLowerCase()) : false)
}

/** True only when the switch is on, the pods answer, and this user belongs to a pilot partner. */
export async function engineReadyFor(user: { id: string; email?: string | null }): Promise<boolean> {
  if (!aethernetLiveEnabled() || !isPilotPartner(user)) return false
  return aethernetReachable()
}

async function call<T>(path: string, init?: { body: unknown }): Promise<T> {
  const response = await fetch(`${BASE_URL}${path}`, {
    method: init ? "POST" : "GET",
    headers: authHeaders(),
    body: init ? JSON.stringify(init.body) : undefined,
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    cache: "no-store",
  })
  if (!response.ok) throw new Error(`AetherNet ${path} returned ${response.status}`)
  return (await response.json()) as T
}

interface RemoteIdentity {
  keyId: string
  dsaPublic: string
  kemPublic: string
}

/** QUAS publishes its keys; this app seals the payment bundle to them so only the enclave can open it. */
export async function loadQuasIdentity(): Promise<Identity> {
  const remote = await call<RemoteIdentity>("/v1/quas/identity")
  if (!remote?.keyId || !remote.dsaPublic || !remote.kemPublic) throw new Error("AetherNet QUAS returned an incomplete identity")
  const kemPublic = createPublicKey({ key: Buffer.from(remote.kemPublic, "base64"), format: "der", type: "spki" })
  return {
    id: "quas",
    label: "AetherNet QUAS",
    keyId: remote.keyId,
    dsaPublic: remote.dsaPublic,
    dsaPrivate: "",
    kemPublic,
    kemPrivate: undefined as never,
  }
}

export async function lookupCounterpartyRemote(query: string): Promise<KvsResult> {
  const result = await call<KvsResult>("/v1/kvs/lookup", { body: { query } })
  if (typeof result?.score !== "number" || !Array.isArray(result.neighbors)) throw new Error("AetherNet KVS returned an unexpected result")
  return { ...result, fallback: false }
}

export interface RemotePolicy {
  pass: boolean
  checks: StepCheck[]
  commandSignature?: string
}

export async function enforceMandatesRemote(input: {
  sealed: SealedMessage
  publicKeys: { buyer: string; supplier: string }
  counterpartyScore: number
}): Promise<RemotePolicy> {
  const result = await call<RemotePolicy>("/v1/quas/enforce", {
    body: {
      envelope: input.sealed.envelope satisfies Envelope,
      header: input.sealed.header,
      publicKeys: input.publicKeys,
      counterpartyScore: input.counterpartyScore,
    },
  })
  if (typeof result?.pass !== "boolean" || !Array.isArray(result.checks)) throw new Error("AetherNet QUAS returned an unexpected verdict")
  return result
}
