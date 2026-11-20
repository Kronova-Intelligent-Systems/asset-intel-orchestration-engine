"use server"

import crypto from "node:crypto"
import { revalidatePath } from "next/cache"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { PushUrlError, validatePushUrl } from "@/lib/a2a/push-notifications"
import { WEBHOOK_EVENT_NAMES } from "@/lib/webhooks/events"
import { deliverWebhook } from "@/lib/webhooks/webhook-delivery"

const MAX_WEBHOOKS_PER_USER = 20
const MAX_NAME_LENGTH = 100
const MAX_DESCRIPTION_LENGTH = 500

// The secret is deliberately excluded: it is returned once, at creation.
const PUBLIC_COLUMNS =
  "id, user_id, name, url, description, events, is_active, last_triggered_at, last_status, failure_count, created_at, updated_at"

interface WebhookInput {
  name?: string
  url?: string
  events?: string[]
  description?: string
  is_active?: boolean
}

async function getAuthenticatedUser() {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return { supabase, user }
}

async function validateInput(input: WebhookInput, requireAll: boolean): Promise<{ error: string } | { value: WebhookInput }> {
  const value: WebhookInput = {}

  if (input.name !== undefined || requireAll) {
    const name = typeof input.name === "string" ? input.name.trim() : ""
    if (!name || name.length > MAX_NAME_LENGTH) return { error: `Name is required (max ${MAX_NAME_LENGTH} characters)` }
    value.name = name
  }

  if (input.url !== undefined || requireAll) {
    try {
      value.url = (await validatePushUrl(input.url)).toString()
    } catch (error) {
      return { error: error instanceof PushUrlError ? error.message : "Invalid URL" }
    }
  }

  if (input.events !== undefined || requireAll) {
    const events = Array.isArray(input.events) ? [...new Set(input.events)] : []
    if (events.length === 0) return { error: "At least one event must be selected" }
    if (events.some((event) => typeof event !== "string" || !WEBHOOK_EVENT_NAMES.includes(event))) {
      return { error: "One or more selected events are not supported" }
    }
    value.events = events
  }

  if (input.description !== undefined) {
    const description = typeof input.description === "string" ? input.description.trim() : ""
    if (description.length > MAX_DESCRIPTION_LENGTH) {
      return { error: `Description must be at most ${MAX_DESCRIPTION_LENGTH} characters` }
    }
    value.description = description || undefined
  }

  if (input.is_active !== undefined) {
    if (typeof input.is_active !== "boolean") return { error: "is_active must be a boolean" }
    value.is_active = input.is_active
  }

  return { value }
}

function friendlyDbError(message: string, code?: string) {
  if (code === "23505") return "A webhook with this name already exists"
  console.error("Webhook database error:", message)
  return "Something went wrong. Please try again."
}

export async function getWebhooks() {
  const { supabase, user } = await getAuthenticatedUser()
  if (!user) return { success: false, error: "Not authenticated" }

  const { data, error } = await supabase
    .from("webhooks")
    .select(PUBLIC_COLUMNS)
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })

  if (error) return { success: false, error: friendlyDbError(error.message, error.code) }
  return { success: true, data }
}

export async function createWebhook(formData: {
  name: string
  url: string
  events: string[]
  description?: string
}) {
  const { supabase, user } = await getAuthenticatedUser()
  if (!user) return { success: false, error: "Not authenticated" }

  const validated = await validateInput(formData, true)
  if ("error" in validated) return { success: false, error: validated.error }

  const { count } = await supabase.from("webhooks").select("id", { count: "exact", head: true }).eq("user_id", user.id)
  if ((count ?? 0) >= MAX_WEBHOOKS_PER_USER) {
    return { success: false, error: `You can create up to ${MAX_WEBHOOKS_PER_USER} webhooks` }
  }

  const secret = `whsec_${crypto.randomBytes(32).toString("hex")}`

  const { data, error } = await supabase
    .from("webhooks")
    .insert({
      user_id: user.id,
      name: validated.value.name,
      url: validated.value.url,
      events: validated.value.events,
      description: validated.value.description ?? null,
      secret,
      is_active: true,
    })
    .select()
    .single()

  if (error) return { success: false, error: friendlyDbError(error.message, error.code) }

  revalidatePath("/ai-suite/settings")
  return { success: true, data }
}

export async function updateWebhook(webhookId: string, formData: WebhookInput) {
  const { supabase, user } = await getAuthenticatedUser()
  if (!user) return { success: false, error: "Not authenticated" }

  const validated = await validateInput(formData, false)
  if ("error" in validated) return { success: false, error: validated.error }

  // Re-enabling a webhook that was auto-disabled starts it with a clean failure count.
  const update = validated.value.is_active ? { ...validated.value, failure_count: 0 } : validated.value

  const { data, error } = await supabase
    .from("webhooks")
    .update(update)
    .eq("id", webhookId)
    .eq("user_id", user.id)
    .select(PUBLIC_COLUMNS)
    .single()

  if (error) return { success: false, error: friendlyDbError(error.message, error.code) }

  revalidatePath("/ai-suite/settings")
  return { success: true, data }
}

export async function deleteWebhook(webhookId: string) {
  const { supabase, user } = await getAuthenticatedUser()
  if (!user) return { success: false, error: "Not authenticated" }

  const { error } = await supabase.from("webhooks").delete().eq("id", webhookId).eq("user_id", user.id)
  if (error) return { success: false, error: friendlyDbError(error.message, error.code) }

  revalidatePath("/ai-suite/settings")
  return { success: true }
}

export async function testWebhook(webhookId: string) {
  const { supabase, user } = await getAuthenticatedUser()
  if (!user) return { success: false, error: "Not authenticated" }

  const { data: webhook } = await supabase
    .from("webhooks")
    .select("id, url, secret")
    .eq("id", webhookId)
    .eq("user_id", user.id)
    .single()

  if (!webhook) return { success: false, error: "Webhook not found" }

  const result = await deliverWebhook({
    url: webhook.url,
    event: "webhook.test",
    payload: { message: "This is a test webhook delivery" },
    userId: user.id,
    webhookId: webhook.id,
    secret: webhook.secret,
    maxAttempts: 1,
  })

  revalidatePath("/ai-suite/settings")
  return {
    success: result.ok,
    status: result.status,
    message: result.ok ? "Webhook test successful" : `Webhook test failed: ${result.error ?? "unknown error"}`,
  }
}

export async function getWebhookLogs(webhookId: string) {
  const { supabase, user } = await getAuthenticatedUser()
  if (!user) return { success: false, error: "Not authenticated" }

  const { data: webhook } = await supabase
    .from("webhooks")
    .select("id")
    .eq("id", webhookId)
    .eq("user_id", user.id)
    .single()

  if (!webhook) return { success: false, error: "Webhook not found" }

  const { data, error } = await supabase
    .from("webhook_logs")
    .select("*")
    .eq("webhook_id", webhookId)
    .order("delivered_at", { ascending: false })
    .limit(100)

  if (error) return { success: false, error: friendlyDbError(error.message, error.code) }
  return { success: true, data }
}
