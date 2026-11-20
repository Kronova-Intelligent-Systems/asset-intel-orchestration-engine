export type ScenarioId = "clean" | "tamper" | "rogue"

/**
 * How honest each step is about what it runs on:
 * - live: real cryptography or a real model call executing in this request
 * - standin: real code that stands in for an enterprise component (QUAS / KVS) that runs in a TEE in production
 * - simulated: modelled output for a component this app does not operate (Canton ledger, physical IoT sensor)
 */
export type Provenance = "live" | "standin" | "simulated" | "aethernet"
export type EngineId = "standin" | "aethernet"

export type ActorId = "buyer" | "supplier" | "gateway" | "kvs" | "quas" | "iot" | "canton" | "platform"
export type Tier = 1 | 2 | 3 | 4
export type StepStatus = "ok" | "rejected" | "info"

export interface StepFact {
  label: string
  value: string
  mono?: boolean
}

export interface StepCheck {
  label: string
  pass: boolean
  detail: string
}

export interface AgentMessage {
  from: ActorId
  to: ActorId
  text: string
  model?: string
  fallback?: boolean
}

export interface DemoStep {
  id: string
  seq: number
  tier: Tier
  actor: ActorId
  title: string
  detail: string
  status: StepStatus
  provenance: Provenance
  durationMs: number
  message?: AgentMessage
  facts?: StepFact[]
  checks?: StepCheck[]
  digest: string
}

export interface DemoResult {
  scenario: ScenarioId
  outcome: "settled" | "blocked"
  headline: string
  blockedBy: string | null
  amountUsd: number
  totalMs: number
  auditRoot: string
  attested: boolean
  a2aTaskId: string | null
  a2aNote: string | null
}

export type DemoEvent =
  | { type: "step"; step: DemoStep }
  | { type: "done"; result: DemoResult }
  | { type: "error"; message: string }

export const SCENARIOS: Record<ScenarioId, { label: string; summary: string }> = {
  clean: {
    label: "Clean settlement",
    summary: "Two agents negotiate, a deterministic policy engine approves the mandate, IoT delivery proof releases escrow.",
  },
  tamper: {
    label: "Man-in-the-middle",
    summary: "An attacker alters the sealed mandate in transit. The gateway and the cipher both refuse it.",
  },
  rogue: {
    label: "Prompt-injected agent",
    summary: "The buyer agent is tricked into over-paying. Deterministic mandate enforcement blocks the payment.",
  },
}
