import { generateText, Output } from "ai"
import { z } from "zod"
import { BUYER_MODELS, SUPPLIER_MODELS, runWithCandidates } from "./models"

export const SCENARIO_FACTS = {
  buyerName: "Meridian Aerospace",
  supplierName: "Helix Precision",
  item: "Ti-6Al-4V actuator housings (AS9100 certified)",
  quantity: 2400,
  ceilingUsd: 2_000_000,
  maxUnitUsd: 833,
}

const CALL_TIMEOUT_MS = 25_000

interface AgentOutput<T> {
  value: T
  model: string
  fallback: boolean
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

const rfqSchema = z.object({
  targetUnitPriceUsd: z.number().describe("Opening unit price in USD"),
  deliveryDays: z.number().describe("Required delivery window in days"),
  message: z.string().describe("Message to the supplier agent, under 45 words"),
})

export async function buyerDraftsRfq(): Promise<AgentOutput<{ targetUnitPriceUsd: number; deliveryDays: number; message: string }>> {
  const { buyerName, supplierName, item, quantity, ceilingUsd } = SCENARIO_FACTS
  const live = await runWithCandidates(BUYER_MODELS, async (model) => {
    const { output } = await generateText({
      model,
      output: Output.object({ schema: rfqSchema }),
      abortSignal: AbortSignal.timeout(CALL_TIMEOUT_MS),
      prompt: `You are the procurement agent for ${buyerName}. Draft an opening request for quotation to the supplier agent at ${supplierName} for ${quantity} units of ${item}. Your human principal set a hard ceiling of $${ceilingUsd.toLocaleString("en-US")} for the whole order. Open with a unit price between 760 and 800 USD and a delivery window between 14 and 30 days. Be concise and professional.`,
    })
    return {
      targetUnitPriceUsd: Math.round(clamp(output.targetUnitPriceUsd, 760, 800)),
      deliveryDays: Math.round(clamp(output.deliveryDays, 14, 30)),
      message: output.message,
    }
  })

  if (live) return { value: live.value, model: live.label, fallback: false }
  return {
    value: {
      targetUnitPriceUsd: 780,
      deliveryDays: 21,
      message: `RFQ for ${quantity} ${item} at an opening $780 per unit, delivery within 21 days, escrow released on verified delivery.`,
    },
    model: BUYER_MODELS[0].label,
    fallback: true,
  }
}

const cartSchema = z.object({
  unitPriceUsd: z.number().describe("Offered unit price in USD"),
  leadTimeDays: z.number().describe("Committed lead time in days"),
  message: z.string().describe("Message to the buyer agent, under 55 words"),
})

export async function supplierDraftsCart(input: {
  rfq: { targetUnitPriceUsd: number; deliveryDays: number }
  counterpartyScore: number
}): Promise<AgentOutput<{ unitPriceUsd: number; leadTimeDays: number; message: string }>> {
  const { supplierName, buyerName, item, quantity } = SCENARIO_FACTS
  const live = await runWithCandidates(SUPPLIER_MODELS, async (model) => {
    const { output } = await generateText({
      model,
      output: Output.object({ schema: cartSchema }),
      abortSignal: AbortSignal.timeout(CALL_TIMEOUT_MS),
      prompt: `You are the fulfilment agent for ${supplierName}. The buyer agent for ${buyerName} requested ${quantity} units of ${item} at an opening $${input.rfq.targetUnitPriceUsd} per unit within ${input.rfq.deliveryDays} days. Your encrypted counterparty memory returned a reliability score of ${input.counterpartyScore}/100 for the buyer, so you accept payment into escrow released on IoT-verified delivery instead of requiring a deposit. Counter with a unit price between 790 and 830 USD and a lead time no longer than ${input.rfq.deliveryDays} days. Mention the escrow term in your message.`,
    })
    return {
      unitPriceUsd: Math.round(clamp(output.unitPriceUsd, 790, 830)),
      leadTimeDays: Math.round(clamp(output.leadTimeDays, 10, input.rfq.deliveryDays)),
      message: output.message,
    }
  })

  if (live) return { value: live.value, model: live.label, fallback: false }
  return {
    value: {
      unitPriceUsd: 815,
      leadTimeDays: Math.min(18, input.rfq.deliveryDays),
      message: `Counter-offer at $815 per unit with an ${Math.min(18, input.rfq.deliveryDays)}-day lead time. Payment into escrow, released on IoT-verified delivery.`,
    },
    model: SUPPLIER_MODELS[0].label,
    fallback: true,
  }
}

export async function buyerAcceptsCart(input: {
  unitPriceUsd: number
  totalUsd: number
  leadTimeDays: number
}): Promise<AgentOutput<{ message: string }>> {
  const { supplierName, ceilingUsd } = SCENARIO_FACTS
  const live = await runWithCandidates(BUYER_MODELS, async (model) => {
    const { text } = await generateText({
      model,
      abortSignal: AbortSignal.timeout(CALL_TIMEOUT_MS),
      maxOutputTokens: 160,
      prompt: `You are the procurement agent for ${SCENARIO_FACTS.buyerName}. ${supplierName} countered at $${input.unitPriceUsd} per unit, $${input.totalUsd.toLocaleString("en-US")} in total, ${input.leadTimeDays} days lead time, with payment held in escrow until an IoT delivery attestation. Your ceiling is $${ceilingUsd.toLocaleString("en-US")}. Accept in two sentences or fewer, and state that you are issuing the signed payment mandate. Plain text only.`,
    })
    return { message: text.trim() }
  })

  if (live) return { value: live.value, model: live.label, fallback: false }
  return {
    value: {
      message: `Accepted at $${input.unitPriceUsd} per unit, $${input.totalUsd.toLocaleString("en-US")} total. Issuing the signed payment mandate into escrow.`,
    },
    model: BUYER_MODELS[0].label,
    fallback: true,
  }
}
