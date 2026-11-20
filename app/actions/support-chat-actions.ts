"use server"

import { createServerSupabaseClient } from "@/lib/supabase/server"
import { AIClient } from "@/lib/ai/ai-client"
import { EmbeddingSystem } from "@/lib/embeddings/embedding-system"
import { transcribeAudioAction } from "@/app/actions/voice-actions"

// ─── Constants ───────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are Kairo, Kronova's intelligent support assistant. You help users understand the Kronova Asset Intelligence platform, AetherNet QUAS, multi-agent AI orchestration, real-world asset (RWA) tokenization, and enterprise workflow automation.

Key facts:
- AetherNet QUAS (Quantum Universal Agentic Substrate) supersedes OAuth for all agent execution. OAuth 2.1 is strictly read-only orchestration. All execution, settlement, and agent mandates bypass OAuth entirely via the AetherNet Cryptographic Airgap using post-quantum signatures (NIST FIPS 204 ML-DSA-65) and ML-KEM-1024 (FIPS 203) sealed envelopes.
- AetherNet KVS (Kinetic Vector Store) is the post-quantum vector store behind QUAS. It runs airgapped inside the private cluster and only the QUAS enclave queries it. Never invent, guess or share hostnames or URLs for QUAS or KVS. External agents reach AetherNet through the edge gateway, and access is provisioned through the Enterprise Design Partner Pilot.
- Two separate planes: the Kronova orchestration and intelligence platform API (app.kronova.io/api/v1, open source, API key or OAuth) and AetherNet QUAS and KVS (commercial, accessed through the edge gateway).
- Kronova supports a 44-field RWA schema for real-world asset tokenization across multiple asset classes.
- Enterprise Pilot applications: https://kronova.io/enterprise-pilot
- Be concise, precise, and professional. Do not speculate beyond known platform facts. If unsure, direct users to support@kronova.io.`

// Map widget model IDs to AIClient provider + model string
const MODEL_MAP: Record<string, { provider: string; model: string; envKey: string }> = {
  "openai/gpt-4o":            { provider: "openai",    model: "gpt-4o",                       envKey: "OPENAI_API_KEY" },
  "openai/gpt-4o-mini":       { provider: "openai",    model: "gpt-4o-mini",                  envKey: "OPENAI_API_KEY" },
  "anthropic/claude-3-5":     { provider: "anthropic", model: "claude-3-5-sonnet-20241022",   envKey: "ANTHROPIC_API_KEY" },
  "anthropic/claude-3-haiku": { provider: "anthropic", model: "claude-3-haiku-20240307",      envKey: "ANTHROPIC_API_KEY" },
  "google/gemini-1-5-pro":    { provider: "google",    model: "gemini-1.5-pro",               envKey: "GOOGLE_AI_API_KEY" },
  "google/gemini-1-5-flash":  { provider: "google",    model: "gemini-1.5-flash",             envKey: "GOOGLE_AI_API_KEY" },
  "mistral/large":            { provider: "mistral",   model: "mistral-large-latest",         envKey: "MISTRAL_API_KEY" },
  "mistral/7b":               { provider: "mistral",   model: "open-mistral-7b",              envKey: "MISTRAL_API_KEY" },
}

// ─── Send message (create conversation on first turn) ────────────────────────

export async function sendSupportMessage(
  conversationId: string | null,
  messages: Array<{ role: "user" | "assistant"; content: string }>,
  modelId: string,
  inputMode: "text" | "voice",
): Promise<{ success: boolean; reply?: string; conversationId?: string; error?: string }> {
  const startTime = Date.now()

  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()

    // Create conversation row on first message — non-fatal if migration not yet applied
    let activeConversationId = conversationId
    if (!activeConversationId) {
      try {
        const { data, error } = await supabase
          .from("support_conversations")
          .insert({ user_id: user?.id ?? null, model_id: modelId, input_mode: inputMode })
          .select("id")
          .single()
        if (!error && data) activeConversationId = data.id
        else console.error("[support-chat] failed to create conversation:", error)
      } catch (err) {
        console.error("[support-chat] conversation insert exception:", err)
      }
    }

    // ── RAG: retrieve relevant knowledge base chunks ─────────────────────────
    let ragContext = ""
    try {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
      const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
      const userQuery = messages[messages.length - 1]?.content ?? ""

      if (supabaseUrl && supabaseServiceKey && userQuery) {
        const embeddingSystem = new EmbeddingSystem(supabaseUrl, supabaseServiceKey)
        // Use the seed user ID as the knowledge base owner for anonymous visitors
        const knowledgeUserId = process.env.KAIRO_SEED_USER_ID ?? user?.id ?? ""

        if (knowledgeUserId) {
          const results = await embeddingSystem.searchSimilarDocuments(
            userQuery,
            knowledgeUserId,
            5,   // top-5 chunks
            0.72 // similarity threshold
          )

          if (results.length > 0) {
            ragContext = results
              .map((r, i) => `[Source ${i + 1}: ${r.metadata?.source_name ?? "Kronova Knowledge Base"}]\n${r.content}`)
              .join("\n\n")
          }
        }
      }
    } catch (ragErr) {
      // RAG failure is non-fatal — fall back to system prompt only
      console.error("[support-chat] RAG retrieval failed (non-fatal):", ragErr)
    }

    // Resolve provider / API key
    const resolved = MODEL_MAP[modelId] ?? MODEL_MAP["openai/gpt-4o"]
    const apiKey = process.env[resolved.envKey] ?? process.env.OPENAI_API_KEY ?? ""

    const client = new AIClient(resolved.provider as any, apiKey, resolved.model)

    // Build system message — inject RAG context when available
    const systemContent = ragContext
      ? `${SYSTEM_PROMPT}\n\n---\nRELEVANT KNOWLEDGE BASE CONTEXT (use this to ground your answer):\n\n${ragContext}\n---`
      : SYSTEM_PROMPT

    const aiMessages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
      { role: "system", content: systemContent },
      ...messages,
    ]

    // AIClient exposes createChatCompletion(), not chat()
    const response = await client.createChatCompletion({
      model: resolved.model,
      messages: aiMessages,
      temperature: 0.4,
      max_tokens: 1024,
    })

    const reply: string =
      response.choices?.[0]?.message?.content ??
      "I'm sorry, I wasn't able to generate a response. Please try again."

    const latencyMs = Date.now() - startTime
    const userMsg = messages[messages.length - 1]

    // Persist both turns non-fatally
    if (activeConversationId) {
      await supabase.from("support_messages").insert([
        {
          conversation_id: activeConversationId,
          role: "user",
          content: userMsg?.content ?? "",
          input_mode: inputMode,
          model_id: modelId,
        },
        {
          conversation_id: activeConversationId,
          role: "assistant",
          content: reply,
          input_mode: inputMode,
          model_id: modelId,
          latency_ms: latencyMs,
        },
      ])

      await supabase.rpc("increment_support_conversation_message_count", {
        p_conversation_id: activeConversationId,
      })

      // After at least one full exchange, write to support_learning
      if (messages.length >= 2 && userMsg?.content) {
        await supabase.from("support_learning").insert({
          conversation_id: activeConversationId,
          question: userMsg.content,
          answer: reply,
          model_id: modelId,
          tags: ["kairo", "support", inputMode],
        })
      }
    }

    return { success: true, reply, conversationId: activeConversationId ?? undefined }
  } catch (err: any) {
    console.error("[support-chat] sendSupportMessage error:", err)
    return { success: false, error: err.message }
  }
}

// ─── Close conversation ───────────────────────────────────────────────────────

export async function closeSupportConversation(conversationId: string): Promise<void> {
  try {
    const supabase = await createServerSupabaseClient()
    await supabase
      .from("support_conversations")
      .update({ ended_at: new Date().toISOString() })
      .eq("id", conversationId)
  } catch (err) {
    console.error("[support-chat] closeSupportConversation error:", err)
  }
}

// ─── Voice transcription via existing voice system ───────────────────────────

export async function transcribeSupportAudio(
  audioData: ArrayBuffer,
): Promise<{ success: boolean; text?: string; error?: string }> {
  try {
    const result = await transcribeAudioAction(audioData, "en")
    return { success: true, text: result.text }
  } catch (err: any) {
    console.error("[support-chat] transcribeSupportAudio error:", err)
    return { success: false, error: err.message }
  }
}
