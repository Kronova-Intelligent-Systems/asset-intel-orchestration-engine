import crypto from "node:crypto"
import type { SupabaseClient } from "@supabase/supabase-js"
import { createAdminSupabaseClient } from "@/lib/supabase/admin"
import { PushUrlError, validatePushUrl } from "@/lib/a2a/push-notifications"

const REQUEST_TIMEOUT_MS = 5_000
const DEFAULT_MAX_ATTEMPTS = 3
const BASE_BACKOFF_MS = 500
const AUTO_DISABLE_AFTER_FAILURES = 10
const MAX_ERROR_LENGTH = 500
const DEFAULT_SIGNATURE_TOLERANCE_SECONDS = 300

export interface DeliverWebhookParams {
  url: string
  event: string
  payload: unknown
  userId: string
  webhookId?: string
  secret?: string
  maxAttempts?: number
}

export interface DeliveryResult {
  ok: boolean
  status: number | null
  attempts: number
  error: string | null
}

// The webhook tables are not part of the generated database types.
function getAdminClient(): SupabaseClient {
  return createAdminSupabaseClient() as unknown as SupabaseClient
}

/**
 * Signature scheme: HMAC-SHA256 over `${timestamp}.${rawBody}`, sent as `sha256=<hex>` in
 * X-Webhook-Signature with the unix timestamp in X-Webhook-Timestamp. Binding the timestamp
 * into the signed content lets receivers reject replayed deliveries.
 */
export function signWebhookPayload(secret: string, timestamp: string, body: string): string {
  const digest = crypto.createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex")
  return `sha256=${digest}`
}

/** Reference verifier for receivers: constant-time compare plus a replay window. */
export function verifyWebhookSignature(params: {
  secret: string
  timestamp: string
  body: string
  signature: string
  toleranceSeconds?: number
  now?: number
}): boolean {
  const { secret, timestamp, body, signature, toleranceSeconds = DEFAULT_SIGNATURE_TOLERANCE_SECONDS } = params
  const sentAt = Number(timestamp)
  if (!Number.isFinite(sentAt)) return false
  const nowSeconds = Math.floor((params.now ?? Date.now()) / 1000)
  if (Math.abs(nowSeconds - sentAt) > toleranceSeconds) return false

  const expected = Buffer.from(signWebhookPayload(secret, timestamp, body))
  const received = Buffer.from(signature)
  return expected.length === received.length && crypto.timingSafeEqual(expected, received)
}

function isRetryableStatus(status: number): boolean {
  return status === 408 || status === 425 || status === 429 || status >= 500
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function recordOutcome(
  params: { webhookId: string; userId: string; event: string; payload: unknown },
  result: DeliveryResult,
) {
  try {
    const admin = getAdminClient()

    await admin.from("webhook_logs").insert({
      webhook_id: params.webhookId,
      event_type: params.event,
      payload: params.payload,
      response_status: result.status,
      error_message: result.error ? `${result.error} (attempts: ${result.attempts})` : null,
    })

    const { data: current } = await admin
      .from("webhooks")
      .select("failure_count")
      .eq("id", params.webhookId)
      .eq("user_id", params.userId)
      .single()

    const failureCount = result.ok ? 0 : (current?.failure_count ?? 0) + 1
    const update: Record<string, unknown> = {
      last_triggered_at: new Date().toISOString(),
      last_status: result.ok ? "success" : "failed",
      failure_count: failureCount,
    }
    if (!result.ok && failureCount >= AUTO_DISABLE_AFTER_FAILURES) update.is_active = false

    await admin.from("webhooks").update(update).eq("id", params.webhookId).eq("user_id", params.userId)
  } catch (error) {
    console.error("Failed to record webhook delivery outcome:", error instanceof Error ? error.message : error)
  }
}

/**
 * Delivers one event. Never throws. The target URL is validated on every attempt (https only,
 * no private or reserved addresses), redirects are not followed, and only transient failures
 * (network errors, 408/425/429/5xx) are retried.
 */
export async function deliverWebhook({
  url,
  event,
  payload,
  userId,
  webhookId,
  secret,
  maxAttempts = DEFAULT_MAX_ATTEMPTS,
}: DeliverWebhookParams): Promise<DeliveryResult> {
  const deliveryId = crypto.randomUUID()
  const webhookPayload = {
    id: deliveryId,
    event,
    data: payload,
    timestamp: new Date().toISOString(),
  }
  const body = JSON.stringify(webhookPayload)

  const result: DeliveryResult = { ok: false, status: null, attempts: 0, error: null }

  while (result.attempts < maxAttempts && !result.ok) {
    result.attempts++

    try {
      const target = await validatePushUrl(url)

      const timestamp = String(Math.floor(Date.now() / 1000))
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        "User-Agent": "Kronova-Webhooks/1.0",
        "X-Webhook-Id": deliveryId,
        "X-Webhook-Event": event,
        "X-Webhook-Timestamp": timestamp,
      }
      if (secret) headers["X-Webhook-Signature"] = signWebhookPayload(secret, timestamp, body)

      const response = await fetch(target, {
        method: "POST",
        headers,
        body,
        redirect: "manual",
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      })

      result.status = response.status
      if (response.status >= 200 && response.status < 300) {
        result.ok = true
        result.error = null
        break
      }

      result.error = `HTTP ${response.status}`
      if (!isRetryableStatus(response.status)) break
    } catch (error) {
      result.status = null
      if (error instanceof PushUrlError) {
        result.error = `blocked: ${error.message}`.slice(0, MAX_ERROR_LENGTH)
        break
      }
      result.error = error instanceof Error && error.name === "TimeoutError" ? "timeout" : "network error"
    }

    if (result.attempts < maxAttempts) await sleep(BASE_BACKOFF_MS * 2 ** (result.attempts - 1))
  }

  if (webhookId) await recordOutcome({ webhookId, userId, event, payload: webhookPayload }, result)

  return result
}

/**
 * Fans an event out to the optional one-off URL and to every active webhook the user
 * subscribed to this event. Uses the admin client because API-key requests have no user
 * session, so row level security would otherwise hide the user's webhooks.
 */
export async function triggerWebhooks(params: {
  userId: string
  event: string
  payload: unknown
  webhookUrl?: unknown
}): Promise<void> {
  const { userId, event, payload, webhookUrl } = params
  const deliveries: Promise<DeliveryResult>[] = []

  if (typeof webhookUrl === "string" && webhookUrl.length > 0) {
    deliveries.push(deliverWebhook({ url: webhookUrl, event, payload, userId }))
  }

  try {
    const { data: webhooks, error } = await getAdminClient()
      .from("webhooks")
      .select("id, url, secret")
      .eq("user_id", userId)
      .eq("is_active", true)
      .contains("events", [event])

    if (error) console.error("Failed to load webhooks:", error.message)

    for (const webhook of webhooks ?? []) {
      deliveries.push(
        deliverWebhook({
          url: webhook.url,
          event,
          payload,
          userId,
          webhookId: webhook.id,
          secret: webhook.secret,
        }),
      )
    }
  } catch (error) {
    console.error("Failed to load webhooks:", error instanceof Error ? error.message : error)
  }

  await Promise.allSettled(deliveries)
}
