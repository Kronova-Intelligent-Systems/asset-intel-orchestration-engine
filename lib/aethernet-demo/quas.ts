import type { StepCheck } from "./types"

export interface IntentMandate {
  type: "AP2.IntentMandate"
  mandateId: string
  item: string
  quantity: number
  ceilingUsd: number
  maxUnitUsd: number
  currency: "USD"
  expiresAt: string
  nonce: string
}

export interface CartMandate {
  type: "AP2.CartMandate"
  mandateId: string
  intentMandateId: string
  quantity: number
  unitPriceUsd: number
  totalUsd: number
  leadTimeDays: number
  nonce: string
}

export interface PaymentMandate {
  type: "AP2.PaymentMandate"
  mandateId: string
  cartMandateId: string
  intentMandateId: string
  amountUsd: number
  asset: "USDCx"
  escrow: { releaseOn: "iot-delivery-attestation"; deviceKeyId: string; units: number; maxShockG: number }
  nonce: string
}

export const MIN_COUNTERPARTY_SCORE = 70

export interface PolicyInput {
  intent: IntentMandate
  cart: CartMandate
  payment: PaymentMandate
  signaturesValid: { intent: boolean; cart: boolean; payment: boolean }
  counterpartyScore: number
  seenNonces: Set<string>
  now?: number
}

const usd = (value: number) => `$${value.toLocaleString("en-US")}`

/**
 * Illustrative deterministic mandate enforcement: plain comparisons, no model in the loop. This is
 * demo code, not AetherNet QUAS. It shows the kind of check QUAS is built to enforce inside a TEE.
 */
export function enforceMandates(input: PolicyInput): { pass: boolean; checks: StepCheck[] } {
  const { intent, cart, payment, signaturesValid, counterpartyScore, seenNonces } = input
  const now = input.now ?? Date.now()
  const nonces = [intent.nonce, cart.nonce, payment.nonce]

  const checks: StepCheck[] = [
    {
      label: "KYA: ML-DSA signatures on all three mandates",
      pass: signaturesValid.intent && signaturesValid.cart && signaturesValid.payment,
      detail: "Intent, cart and payment mandates verified against registered agent keys",
    },
    {
      label: "Mandate chain is unbroken",
      pass: payment.cartMandateId === cart.mandateId && cart.intentMandateId === intent.mandateId,
      detail: "payment → cart → intent identifiers match",
    },
    {
      label: "Payment equals the countersigned cart total",
      pass: payment.amountUsd === cart.quantity * cart.unitPriceUsd && cart.totalUsd === cart.quantity * cart.unitPriceUsd,
      detail: `${usd(payment.amountUsd)} requested vs ${usd(cart.quantity * cart.unitPriceUsd)} agreed`,
    },
    {
      label: "Within the human-set spending ceiling",
      pass: payment.amountUsd <= intent.ceilingUsd,
      detail: `${usd(payment.amountUsd)} against a ${usd(intent.ceilingUsd)} ceiling`,
    },
    {
      label: "Unit price within the intent cap",
      pass: cart.unitPriceUsd <= intent.maxUnitUsd,
      detail: `$${cart.unitPriceUsd} against a $${intent.maxUnitUsd} cap`,
    },
    {
      label: "Mandate has not expired",
      pass: Date.parse(intent.expiresAt) > now,
      detail: `Valid until ${intent.expiresAt}`,
    },
    {
      label: "Counterparty risk score",
      pass: counterpartyScore >= MIN_COUNTERPARTY_SCORE,
      detail: `${counterpartyScore}/100 against a minimum of ${MIN_COUNTERPARTY_SCORE}`,
    },
    {
      label: "No replayed nonce",
      pass: nonces.every((nonce) => !seenNonces.has(nonce)) && new Set(nonces).size === nonces.length,
      detail: "Each mandate carries a single-use nonce",
    },
    {
      label: "Escrow release condition is bound to a device key",
      pass: Boolean(payment.escrow.deviceKeyId) && payment.escrow.units === cart.quantity,
      detail: "Release requires a signed IoT delivery attestation for the full quantity",
    },
  ]

  if (checks.every((check) => check.pass)) for (const nonce of nonces) seenNonces.add(nonce)
  return { pass: checks.every((check) => check.pass), checks }
}
