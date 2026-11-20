/**
 * A2A push notifications: webhook URL validation and delivery.
 *
 * Webhook URLs come from untrusted callers, so every URL is checked before the server
 * connects to it: https only, no credentials, restricted ports, and no hostname that
 * resolves to a private, loopback, link-local or otherwise reserved address.
 */

import { lookup as dnsLookup } from "node:dns/promises"
import { isIP } from "node:net"

export const PUSH_EVENTS = ["status_update", "artifact_update"] as const
export type PushEvent = (typeof PUSH_EVENTS)[number]

export const MAX_PUSH_CONFIGS_PER_TASK = 5

const DELIVERY_TIMEOUT_MS = 5_000
const MAX_URL_LENGTH = 2048
const ALLOWED_PORTS = new Set(["", "443", "8443"])
const BLOCKED_HOST_SUFFIXES = [".localhost", ".local", ".internal", ".lan", ".home.arpa"]

export class PushUrlError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "PushUrlError"
  }
}

export interface PushDeps {
  lookup?: (host: string, options: { all: true }) => Promise<Array<{ address: string }>>
  fetch?: typeof fetch
}

export interface PushTarget {
  url: string
  authentication?: { schemes?: string[]; credentials?: string; token?: string } | null
}

export interface PushDeliveryResult {
  ok: boolean
  status: string
}

function isBlockedIPv4(ip: string): boolean {
  const [a, b, c] = ip.split(".").map(Number)
  if (a === 0 || a === 10 || a === 127) return true
  if (a === 169 && b === 254) return true
  if (a === 172 && b >= 16 && b <= 31) return true
  if (a === 192 && b === 168) return true
  if (a === 100 && b >= 64 && b <= 127) return true
  if (a === 192 && b === 0 && (c === 0 || c === 2)) return true
  if (a === 198 && (b === 18 || b === 19)) return true
  if (a === 198 && b === 51 && c === 100) return true
  if (a === 203 && b === 0 && c === 113) return true
  return a >= 224
}

function isBlockedIPv6(raw: string): boolean {
  const ip = raw.toLowerCase().split("%")[0]

  const mappedDotted = ip.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/)
  if (mappedDotted) return isBlockedIPv4(mappedDotted[1])

  const mappedHex = ip.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/)
  if (mappedHex) {
    const high = parseInt(mappedHex[1], 16)
    const low = parseInt(mappedHex[2], 16)
    return isBlockedIPv4(`${high >> 8}.${high & 255}.${low >> 8}.${low & 255}`)
  }

  // "::", "::1" and the deprecated IPv4-compatible range all start with "::"
  if (ip.startsWith("::")) return true

  const first = parseInt(ip.split(":")[0] || "0", 16)
  if ((first & 0xfe00) === 0xfc00) return true // unique local, fc00::/7
  if ((first & 0xffc0) === 0xfe80) return true // link local, fe80::/10
  if ((first & 0xff00) === 0xff00) return true // multicast
  if (first === 0x2002) return true // 6to4 can embed private IPv4 addresses
  return ip.startsWith("64:ff9b:") || ip.startsWith("2001:db8:")
}

function isBlockedAddress(address: string): boolean {
  return isIP(address) === 6 ? isBlockedIPv6(address) : isBlockedIPv4(address)
}

/** Throws PushUrlError unless the URL is safe for the server to call. Returns the parsed URL. */
export async function validatePushUrl(raw: unknown, deps: PushDeps = {}): Promise<URL> {
  if (typeof raw !== "string" || raw.length === 0 || raw.length > MAX_URL_LENGTH) {
    throw new PushUrlError(`Push notification url must be a string of at most ${MAX_URL_LENGTH} characters`)
  }

  let url: URL
  try {
    url = new URL(raw)
  } catch {
    throw new PushUrlError("Push notification url is not a valid URL")
  }

  if (url.protocol !== "https:") throw new PushUrlError("Push notification url must use https")
  if (url.username || url.password) throw new PushUrlError("Push notification url must not contain credentials")
  if (!ALLOWED_PORTS.has(url.port)) throw new PushUrlError("Push notification url must use port 443 or 8443")

  const host = url.hostname.replace(/^\[|\]$/g, "").toLowerCase()
  if (host === "localhost" || BLOCKED_HOST_SUFFIXES.some((suffix) => host.endsWith(suffix))) {
    throw new PushUrlError("Push notification url must be a public hostname")
  }

  let addresses: string[]
  if (isIP(host)) {
    addresses = [host]
  } else {
    try {
      addresses = (await (deps.lookup ?? dnsLookup)(host, { all: true })).map((entry) => entry.address)
    } catch {
      throw new PushUrlError(`Push notification hostname ${host} does not resolve`)
    }
    if (addresses.length === 0) throw new PushUrlError(`Push notification hostname ${host} does not resolve`)
  }

  if (addresses.some(isBlockedAddress)) {
    throw new PushUrlError("Push notification url resolves to a private or reserved address")
  }
  return url
}

function buildHeaders(target: PushTarget, event: PushEvent): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "User-Agent": "Kronova-A2A/1.0",
    "X-Kronova-Event": event,
  }
  const auth = target.authentication
  if (auth?.token) headers["X-A2A-Notification-Token"] = auth.token
  if (auth?.credentials) {
    const scheme = auth.schemes?.[0]
    headers.Authorization = scheme ? `${scheme} ${auth.credentials}` : auth.credentials
  }
  return headers
}

/**
 * Sends one notification. Never throws: failures are reported in the result so a bad webhook
 * cannot break the request that triggered it. Redirects are not followed, because a redirect
 * could point at an internal address that validation never saw.
 */
export async function deliverPush(
  target: PushTarget,
  event: PushEvent,
  payload: unknown,
  deps: PushDeps = {},
): Promise<PushDeliveryResult> {
  try {
    const url = await validatePushUrl(target.url, deps)
    const response = await (deps.fetch ?? fetch)(url, {
      method: "POST",
      headers: buildHeaders(target, event),
      body: JSON.stringify(payload),
      redirect: "manual",
      signal: AbortSignal.timeout(DELIVERY_TIMEOUT_MS),
    })
    return { ok: response.status >= 200 && response.status < 300, status: String(response.status) }
  } catch (error) {
    if (error instanceof PushUrlError) return { ok: false, status: `blocked: ${error.message}`.slice(0, 200) }
    const timedOut = error instanceof Error && error.name === "TimeoutError"
    return { ok: false, status: timedOut ? "error: timeout" : "error: network" }
  }
}
