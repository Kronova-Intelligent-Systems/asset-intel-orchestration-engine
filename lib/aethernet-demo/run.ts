import { randomUUID } from "node:crypto"
import type { SupabaseClient } from "@supabase/supabase-js"
import { createKronovaA2AClient } from "@/lib/a2a/kronova-a2a-client"
import { canonicalJson, type PqcSignature } from "@/lib/pqc/envelope"
import { attest } from "@/lib/pqc/service"
import { SCENARIO_FACTS, buyerAcceptsCart, buyerDraftsRfq, supplierDraftsCart } from "./agents"
import {
  byteLength,
  createIdentity,
  gatewayVerify,
  hexPreview,
  open,
  seal,
  sha256Hex,
  shortKey,
  signBody,
  tamperWith,
  verifyBody,
  type SealedMessage,
} from "./crypto"
import { enforceMandatesRemote, loadQuasIdentity, lookupCounterpartyRemote } from "./engine"
import { lookupCounterparty } from "./kvs"
import {
  MIN_COUNTERPARTY_SCORE,
  enforceMandates,
  type CartMandate,
  type IntentMandate,
  type PaymentMandate,
} from "./quas"
import type { DemoEvent, DemoResult, DemoStep, EngineId, ScenarioId, StepCheck, StepFact } from "./types"

export interface RunContext {
  userId: string
  supabase: SupabaseClient
  engine: EngineId
}

interface Signed<T> {
  mandate: T
  signature: PqcSignature
}

type StepInput = Omit<DemoStep, "seq" | "durationMs" | "digest">

const usd = (value: number) => `$${value.toLocaleString("en-US")}`
const ledgerId = (seed: string) => `00${sha256Hex(seed).slice(0, 40)}`

function sealFacts(sealed: SealedMessage): StepFact[] {
  return [
    { label: "ML-KEM-1024 encapsulation", value: `${byteLength(sealed.envelope.kemCiphertext)} bytes` },
    { label: "AES-256-GCM ciphertext", value: `${byteLength(sealed.envelope.ciphertext)} bytes` },
    { label: "Ciphertext preview", value: hexPreview(sealed.envelope.ciphertext), mono: true },
    { label: "ML-DSA routing signature", value: `${byteLength(sealed.header.signature.signature)} bytes` },
  ]
}

export async function* runDemo(scenario: ScenarioId, ctx: RunContext): AsyncGenerator<DemoEvent> {
  const startedAt = Date.now()
  let lap = startedAt
  let seq = 0
  let chain = "genesis"
  const seenNonces = new Set<string>()

  const emit = (input: StepInput): DemoEvent => {
    const now = Date.now()
    seq += 1
    chain = sha256Hex(
      `${chain}|${canonicalJson({ id: input.id, status: input.status, title: input.title, facts: input.facts ?? [], checks: input.checks ?? [] })}`,
    )
    const step: DemoStep = { ...input, seq, durationMs: now - lap, digest: chain }
    lap = now
    return { type: "step", step }
  }

  async function* finalize(
    outcome: DemoResult["outcome"],
    headline: string,
    blockedBy: string | null,
    amountUsd: number,
  ): AsyncGenerator<DemoEvent> {
    const auditRoot = chain
    const attestation = await attest("aethernet.attestation", { auditRoot, scenario, outcome })
    const a2a = await recordA2ATask(ctx, { scenario, outcome, headline, auditRoot, amountUsd })

    yield emit({
      id: "record",
      tier: 1,
      actor: "platform",
      title: "Audit trail sealed and recorded as an A2A task",
      detail:
        "Every step above is hash-chained. The chain head is countersigned by the platform ML-DSA key and stored as a Kronova A2A task you can open in the AetherNet dashboard.",
      status: "ok",
      provenance: "live",
      facts: [
        { label: "Audit root (SHA-256)", value: auditRoot.slice(0, 32) + "…", mono: true },
        { label: "Platform attestation", value: attestation ? `ML-DSA-65, key ${shortKey(attestation.keyId)}` : "Not configured" },
        { label: "A2A task", value: a2a.taskId ?? a2a.note ?? "Not recorded", mono: Boolean(a2a.taskId) },
      ],
    })

    yield {
      type: "done",
      result: {
        scenario,
        outcome,
        headline,
        blockedBy,
        amountUsd,
        totalMs: Date.now() - startedAt,
        auditRoot,
        attested: Boolean(attestation),
        a2aTaskId: a2a.taskId,
        a2aNote: a2a.note,
      },
    }
  }

  const enclave = ctx.engine === "aethernet"

  // 1. KYA: every agent and device receives a post-quantum identity. With AetherNet, QUAS publishes its own keys.
  const [buyer, supplier, quas, iot] = await Promise.all([
    createIdentity("buyer", "Meridian procurement agent"),
    createIdentity("supplier", "Helix fulfilment agent"),
    enclave ? loadQuasIdentity() : createIdentity("quas", "Settlement authority"),
    createIdentity("iot", "Cargo sensor"),
  ])
  const publicKeys = { buyer: buyer.dsaPublic, supplier: supplier.dsaPublic, iot: iot.dsaPublic, quas: quas.dsaPublic }

  yield emit({
    id: "kya",
    tier: 1,
    actor: "platform",
    title: "Know-Your-Agent identities issued",
    detail:
      "Each agent and the cargo sensor generated an ML-DSA-65 signing key in WebAssembly and an ML-KEM-1024 key for receiving sealed messages. The public halves form the registry every verifier trusts.",
    status: "ok",
    provenance: "live",
    facts: [
      { label: "Buyer agent", value: `pqc_${shortKey(buyer.keyId)}…`, mono: true },
      { label: "Supplier agent", value: `pqc_${shortKey(supplier.keyId)}…`, mono: true },
      { label: "Cargo sensor", value: `pqc_${shortKey(iot.keyId)}…`, mono: true },
      { label: "Public key size", value: "1,952 bytes (ML-DSA-65)" },
    ],
  })

  // 2. The buyer agent drafts an RFQ and signs the Intent Mandate
  const rfq = await buyerDraftsRfq()
  const intent: IntentMandate = {
    type: "AP2.IntentMandate",
    mandateId: `intent-${randomUUID().slice(0, 8)}`,
    item: SCENARIO_FACTS.item,
    quantity: SCENARIO_FACTS.quantity,
    ceilingUsd: SCENARIO_FACTS.ceilingUsd,
    maxUnitUsd: SCENARIO_FACTS.maxUnitUsd,
    currency: "USD",
    expiresAt: new Date(Date.now() + 15 * 60_000).toISOString(),
    nonce: randomUUID(),
  }
  const signedIntent: Signed<IntentMandate> = { mandate: intent, signature: await signBody(buyer, "aethernet.message", intent) }

  yield emit({
    id: "rfq",
    tier: 1,
    actor: "buyer",
    title: "Buyer agent opens negotiation under a signed Intent Mandate",
    detail: `Spending authority is bound to a ${usd(intent.ceilingUsd)} ceiling and ${usd(intent.maxUnitUsd)} per unit, signed with the buyer's ML-DSA key.`,
    status: "ok",
    provenance: "live",
    message: { from: "buyer", to: "supplier", text: rfq.value.message, model: rfq.model, fallback: rfq.fallback },
    facts: [
      { label: "Quantity", value: `${intent.quantity.toLocaleString("en-US")} units` },
      { label: "Opening price", value: `${usd(rfq.value.targetUnitPriceUsd)} / unit` },
      { label: "Ceiling (human-set)", value: usd(intent.ceilingUsd) },
    ],
  })

  // 3. Seal the intent for the supplier
  const sealedIntent = await seal(buyer, supplier, signedIntent)
  const intentOnWire = scenario === "tamper" ? tamperWith(sealedIntent) : sealedIntent

  yield emit({
    id: "seal-intent",
    tier: 1,
    actor: "buyer",
    title: "Mandate sealed in a quantum-resistant envelope",
    detail:
      "ML-KEM-1024 encapsulates a fresh key to the supplier agent, AES-256-GCM encrypts the mandate, and the buyer signs the envelope digest so a proxy can authenticate it without reading it.",
    status: "ok",
    provenance: "live",
    facts: sealFacts(sealedIntent),
  })

  // 4. Blind gateway
  const gatewayIntent = await gatewayVerify(intentOnWire, publicKeys.buyer)
  if (!gatewayIntent.ok) {
    const decrypt = open(supplier, intentOnWire.envelope)
    yield emit({
      id: "gateway-intent",
      tier: 2,
      actor: "gateway",
      title: "Gateway rejected the envelope",
      detail:
        "An on-path attacker flipped a single bit of ciphertext. The signed digest no longer matches, so the blind proxy drops the message before it reaches any agent.",
      status: "rejected",
      provenance: "standin",
      facts: [
        { label: "Tampered ciphertext", value: hexPreview(intentOnWire.envelope.ciphertext), mono: true },
        { label: "Plaintext visible to gateway", value: "None" },
      ],
      checks: [
        { label: "Routing header ML-DSA signature", pass: false, detail: gatewayIntent.reason },
        {
          label: "AES-256-GCM authentication (defence in depth)",
          pass: decrypt.ok,
          detail: decrypt.ok ? "Authenticated" : decrypt.reason,
        },
      ],
    })
    yield* finalize("blocked", "Tampered mandate stopped at the edge. No funds moved.", "Gateway signature check", 0)
    return
  }

  yield emit({
    id: "gateway-intent",
    tier: 2,
    actor: "gateway",
    title: "Gateway verified the signature and routed ciphertext it cannot read",
    detail: "The edge proxy checks the sender's ML-DSA signature over the envelope digest, then forwards opaque bytes over TLS.",
    status: "ok",
    provenance: "standin",
    facts: [
      { label: "Envelope digest", value: gatewayIntent.digest.slice(0, 24) + "…", mono: true },
      { label: "Plaintext visible to gateway", value: "None" },
    ],
    checks: [{ label: "Routing header ML-DSA signature", pass: true, detail: `Signed by pqc_${shortKey(buyer.keyId)}…` }],
  })

  // 5. Supplier opens the envelope and verifies the mandate
  const openedIntent = open<Signed<IntentMandate>>(supplier, intentOnWire.envelope)
  const intentVerified =
    openedIntent.ok && (await verifyBody(publicKeys.buyer, "aethernet.message", openedIntent.value.mandate, openedIntent.value.signature))

  yield emit({
    id: "open-intent",
    tier: 1,
    actor: "supplier",
    title: "Supplier agent decrypted and authenticated the mandate",
    detail: "Only the supplier's ML-KEM private key can recover the session key. The inner mandate signature proves who authorised it.",
    status: intentVerified ? "ok" : "rejected",
    provenance: "live",
    checks: [
      { label: "ML-KEM decapsulation + AES-GCM tag", pass: openedIntent.ok, detail: openedIntent.ok ? "Payload authenticated" : openedIntent.reason },
      { label: "Inner ML-DSA mandate signature", pass: Boolean(intentVerified), detail: "Matches the buyer key in the registry" },
    ],
  })

  // 6. Counterparty memory
  const counterpartyProfile =
    "Aerospace manufacturer buying precision titanium actuator housings cross-border, funds escrow before delivery, more than thirty prior settlements"
  const kvs = enclave ? await lookupCounterpartyRemote(counterpartyProfile) : await lookupCounterparty(counterpartyProfile)
  yield emit({
    id: "kvs",
    tier: 3,
    actor: "kvs",
    title: "Counterparty risk read from semantic memory",
    detail: enclave
      ? "The supplier agent's query is answered by AetherNet KVS, the post-quantum secure vector store running in an attested enclave. Embedding and similarity search happen inside the enclave boundary, not in this application."
      : "The supplier agent embeds the buyer's profile and searches prior settlement history by cosine similarity. Here it runs in this server process as a stand-in. AetherNet KVS is built to run this kind of lookup inside an enclave.",
    status: kvs.score >= MIN_COUNTERPARTY_SCORE ? "ok" : "rejected",
    provenance: enclave ? "aethernet" : "standin",
    facts: [
      { label: "Embedding model", value: kvs.model },
      { label: "Vector dimensions", value: String(kvs.dimensions) },
      ...kvs.neighbors.map((n) => ({
        label: n.label,
        value: `similarity ${n.similarity.toFixed(2)}, reliability ${n.reliability}`,
      })),
      { label: "Weighted risk score", value: `${kvs.score} / 100` },
    ],
  })

  // 7. Supplier counter-offer
  const cartDraft = await supplierDraftsCart({ rfq: rfq.value, counterpartyScore: kvs.score })
  const cart: CartMandate = {
    type: "AP2.CartMandate",
    mandateId: `cart-${randomUUID().slice(0, 8)}`,
    intentMandateId: intent.mandateId,
    quantity: intent.quantity,
    unitPriceUsd: cartDraft.value.unitPriceUsd,
    totalUsd: intent.quantity * cartDraft.value.unitPriceUsd,
    leadTimeDays: cartDraft.value.leadTimeDays,
    nonce: randomUUID(),
  }
  const signedCart: Signed<CartMandate> = { mandate: cart, signature: await signBody(supplier, "aethernet.message", cart) }

  yield emit({
    id: "cart",
    tier: 1,
    actor: "supplier",
    title: "Supplier agent counter-offers with a signed Cart Mandate",
    detail: "A second model reasons over the decrypted request and the risk score, then commits to price and lead time with its own signature.",
    status: "ok",
    provenance: "live",
    message: { from: "supplier", to: "buyer", text: cartDraft.value.message, model: cartDraft.model, fallback: cartDraft.fallback },
    facts: [
      { label: "Unit price", value: usd(cart.unitPriceUsd) },
      { label: "Order total", value: usd(cart.totalUsd) },
      { label: "Lead time", value: `${cart.leadTimeDays} days` },
    ],
  })

  // 8. Route the cart back through the gateway
  const sealedCart = await seal(supplier, buyer, signedCart)
  const gatewayCart = await gatewayVerify(sealedCart, publicKeys.supplier)
  const openedCart = open<Signed<CartMandate>>(buyer, sealedCart.envelope)
  const cartVerified =
    gatewayCart.ok &&
    openedCart.ok &&
    (await verifyBody(publicKeys.supplier, "aethernet.message", openedCart.value.mandate, openedCart.value.signature))

  yield emit({
    id: "route-cart",
    tier: 2,
    actor: "gateway",
    title: "Counter-offer routed back, sealed end to end",
    detail: "The same envelope pipeline runs in the other direction with the supplier's keys.",
    status: cartVerified ? "ok" : "rejected",
    provenance: "standin",
    facts: sealFacts(sealedCart),
    checks: [
      { label: "Gateway signature check", pass: gatewayCart.ok, detail: gatewayCart.ok ? "Header authentic" : gatewayCart.reason },
      { label: "Buyer decrypt + inner signature", pass: Boolean(cartVerified), detail: "Cart Mandate authentic" },
    ],
  })

  // 9. Buyer accepts and issues the Payment Mandate
  const injected = scenario === "rogue"
  const acceptance = injected
    ? {
        value: {
          message: `Understood. The amended invoice supersedes the earlier terms, so I am issuing payment for ${usd(2_400_000)} immediately.`,
        },
        model: rfq.model,
        fallback: false,
      }
    : await buyerAcceptsCart({ unitPriceUsd: cart.unitPriceUsd, totalUsd: cart.totalUsd, leadTimeDays: cart.leadTimeDays })

  const payment: PaymentMandate = {
    type: "AP2.PaymentMandate",
    mandateId: `pay-${randomUUID().slice(0, 8)}`,
    cartMandateId: cart.mandateId,
    intentMandateId: intent.mandateId,
    amountUsd: injected ? 2_400_000 : cart.totalUsd,
    asset: "USDCx",
    escrow: { releaseOn: "iot-delivery-attestation", deviceKeyId: iot.keyId, units: cart.quantity, maxShockG: 5 },
    nonce: randomUUID(),
  }
  const signedPayment: Signed<PaymentMandate> = { mandate: payment, signature: await signBody(buyer, "aethernet.message", payment) }
  const bundle = { intent: signedIntent, cart: signedCart, payment: signedPayment }
  const sealedPayment = await seal(buyer, quas, bundle)

  yield emit({
    id: "accept",
    tier: 1,
    actor: "buyer",
    title: injected ? "Buyer agent is manipulated into approving an inflated payment" : "Buyer agent accepts and signs the Payment Mandate",
    detail: injected
      ? "Scripted attack: the supplier's message carries a prompt injection claiming an 'amended invoice'. The compromised buyer signs it. Nothing in the language model stands in its way."
      : "Payment is bound to the countersigned cart and to a release condition: a signed delivery attestation from the cargo sensor.",
    status: injected ? "info" : "ok",
    provenance: injected ? "simulated" : "live",
    message: { from: "buyer", to: "quas", text: acceptance.value.message, model: injected ? undefined : acceptance.model, fallback: acceptance.fallback },
    facts: [
      { label: "Amount requested", value: usd(payment.amountUsd) },
      { label: "Asset", value: payment.asset },
      { label: "Release condition", value: "Signed IoT delivery attestation" },
    ],
  })

  const gatewayPayment = await gatewayVerify(sealedPayment, publicKeys.buyer)
  yield emit({
    id: "route-payment",
    tier: 2,
    actor: "gateway",
    title: "Settlement request routed as ciphertext to the mandate policy engine",
    detail: "The gateway verifies the buyer's signature and forwards three nested mandates it cannot read.",
    status: gatewayPayment.ok ? "ok" : "rejected",
    provenance: "standin",
    facts: sealFacts(sealedPayment),
  })

  // 10. QUAS: deterministic mandate enforcement
  let policy: { pass: boolean; checks: StepCheck[]; commandSignature?: string }
  if (enclave) {
    policy = await enforceMandatesRemote({
      sealed: sealedPayment,
      publicKeys: { buyer: publicKeys.buyer, supplier: publicKeys.supplier },
      counterpartyScore: kvs.score,
    })
  } else {
    const openedBundle = open<typeof bundle>(quas, sealedPayment.envelope)
    const verified = openedBundle.ok
      ? {
          intent: await verifyBody(publicKeys.buyer, "aethernet.message", openedBundle.value.intent.mandate, openedBundle.value.intent.signature),
          cart: await verifyBody(publicKeys.supplier, "aethernet.message", openedBundle.value.cart.mandate, openedBundle.value.cart.signature),
          payment: await verifyBody(publicKeys.buyer, "aethernet.message", openedBundle.value.payment.mandate, openedBundle.value.payment.signature),
        }
      : { intent: false, cart: false, payment: false }

    policy = openedBundle.ok
      ? enforceMandates({
          intent: openedBundle.value.intent.mandate,
          cart: openedBundle.value.cart.mandate,
          payment: openedBundle.value.payment.mandate,
          signaturesValid: verified,
          counterpartyScore: kvs.score,
          seenNonces,
        })
      : { pass: false, checks: [{ label: "Decapsulate envelope", pass: false, detail: openedBundle.reason } satisfies StepCheck] }
  }

  const firstFailure = policy.checks.find((check) => !check.pass)
  yield emit({
    id: "quas",
    tier: 3,
    actor: "quas",
    title: policy.pass
      ? "Mandate policy engine approved the settlement command"
      : "Mandate policy engine refused to sign the settlement command",
    detail: enclave
      ? policy.pass
        ? "The sealed bundle was decrypted and enforced inside AetherNet QUAS, a bare-metal Rust enclave. This application never held the plaintext mandates. Every rule passed, and QUAS signed the settlement command."
        : "The sealed bundle was decrypted and enforced inside AetherNet QUAS. The signature on the payment is genuine, but the request breaks the buyer's own rules. QUAS refused to sign, so no ledger command is produced."
      : policy.pass
        ? "Runs in this app's server process as an open-source stand-in for the role AetherNet QUAS fills in a TEE. The envelope was opened and every mandate rule passed. These are plain comparisons, so no model can be talked around them."
        : "Runs in this app's server process as a stand-in for AetherNet QUAS. The signature on the payment is genuine, but the request breaks the buyer's own rules. Deterministic enforcement does not negotiate, and no ledger command is produced.",
    status: policy.pass ? "ok" : "rejected",
    provenance: enclave ? "aethernet" : "standin",
    checks: policy.checks,
  })

  if (!policy.pass) {
    yield* finalize(
      "blocked",
      `Payment of ${usd(payment.amountUsd)} refused. The buyer's ${usd(intent.ceilingUsd)} ceiling held and no funds moved.`,
      firstFailure?.label ?? "Mandate enforcement",
      0,
    )
    return
  }

  // 11. Escrow on the ledger
  const escrowId = ledgerId(`escrow:${payment.mandateId}`)
  const escrowCommand = { template: "Kronova.Settlement:ConditionalEscrow", escrowId, amountUsd: payment.amountUsd, asset: payment.asset }
  const escrowSignatureBytes = enclave
    ? policy.commandSignature
      ? byteLength(policy.commandSignature)
      : null
    : byteLength((await signBody(quas, "aethernet.message", escrowCommand)).signature)

  yield emit({
    id: "escrow",
    tier: 4,
    actor: "canton",
    title: "Funds locked in a conditional escrow contract",
    detail: enclave
      ? "AetherNet QUAS signs the ledger command inside the enclave and the escrow is created. The Canton ledger layer is still modelled in this application."
      : "The policy engine signs a ledger command and the escrow is created. This ledger layer is modelled here; the command signature is real ML-DSA.",
    status: "ok",
    provenance: "simulated",
    facts: [
      { label: "Contract", value: escrowCommand.template, mono: true },
      { label: "Contract ID", value: escrowId.slice(0, 26) + "…", mono: true },
      { label: "Locked", value: `${usd(payment.amountUsd)} ${payment.asset}` },
      {
        label: "Command signature",
        value: escrowSignatureBytes === null ? "Signed by QUAS" : `${escrowSignatureBytes} bytes ML-DSA`,
      },
    ],
  })

  // 12. IoT delivery attestation
  const attestationBody = {
    shipmentId: `SHP-${intent.mandateId.slice(-6).toUpperCase()}`,
    units: cart.quantity,
    insideDeliveryGeofence: true,
    maxShockG: 2.1,
    tempRangeC: [14, 22],
    deliveredAt: new Date().toISOString(),
  }
  const deliverySignature = await signBody(iot, "aethernet.attestation", attestationBody)
  const deliveryVerified = await verifyBody(publicKeys.iot, "aethernet.attestation", attestationBody, deliverySignature)
  const deliveryChecks: StepCheck[] = [
    { label: "Sensor ML-DSA signature", pass: deliveryVerified, detail: `Device key pqc_${shortKey(iot.keyId)}… is the one bound in the mandate` },
    { label: "Device matches mandate", pass: deliverySignature.keyId === payment.escrow.deviceKeyId, detail: "Release condition names this sensor" },
    { label: "Full quantity delivered", pass: attestationBody.units === payment.escrow.units, detail: `${attestationBody.units.toLocaleString("en-US")} of ${payment.escrow.units.toLocaleString("en-US")} units` },
    { label: "Shock within limit", pass: attestationBody.maxShockG <= payment.escrow.maxShockG, detail: `${attestationBody.maxShockG} g against a ${payment.escrow.maxShockG} g limit` },
    { label: "Inside delivery geofence", pass: attestationBody.insideDeliveryGeofence, detail: "Receiving dock confirmed" },
  ]
  const deliveryOk = deliveryChecks.every((check) => check.pass)

  yield emit({
    id: "delivery",
    tier: 1,
    actor: "iot",
    title: "Cargo sensor signs a delivery attestation",
    detail:
      "The IoT device signs what it measured. The readings are scripted for this demo; the signing and verification are real, and the same path serves devices registered in the IoT Command Center.",
    status: deliveryOk ? "ok" : "rejected",
    provenance: "simulated",
    checks: deliveryChecks,
  })

  if (!deliveryOk) {
    yield* finalize("blocked", "Delivery proof failed verification. Escrow stays locked.", "IoT attestation", 0)
    return
  }

  // 13. Atomic settlement
  const settlementId = ledgerId(`settle:${payment.mandateId}:${deliverySignature.signature.slice(0, 16)}`)
  yield emit({
    id: "settle",
    tier: 4,
    actor: "canton",
    title: "Escrow released: atomic delivery-versus-payment",
    detail:
      "Payment and title transfer in one transaction, as a ledger would settle it. The ledger is modelled in this demo; no Canton network is involved.",
    status: "ok",
    provenance: "simulated",
    facts: [
      { label: "Settlement ID", value: settlementId.slice(0, 26) + "…", mono: true },
      { label: "Paid to Helix Precision", value: `${usd(payment.amountUsd)} ${payment.asset}` },
      { label: "Record type", value: "Controllable electronic record (UCC Article 12)" },
      { label: "Modelled visibility", value: "Meridian, Helix and the policy engine only" },
    ],
  })

  yield* finalize(
    "settled",
    `${usd(payment.amountUsd)} settled against IoT-verified delivery of ${cart.quantity.toLocaleString("en-US")} units.`,
    null,
    payment.amountUsd,
  )
}

async function recordA2ATask(
  ctx: RunContext,
  summary: { scenario: ScenarioId; outcome: string; headline: string; auditRoot: string; amountUsd: number },
): Promise<{ taskId: string | null; note: string | null }> {
  try {
    const client = createKronovaA2AClient({ supabase: ctx.supabase, userId: ctx.userId, aethernetAddress: "aethernet://demo/meridian-helix" })
    const created = await client.sendMessage({
      message: {
        messageId: `msg-${randomUUID()}`,
        role: "agent",
        parts: [
          { type: "text", text: `AetherNet demo (${summary.scenario}): ${summary.headline}` },
          { type: "data", data: { demo: "aethernet-settlement", ...summary } },
        ],
      },
      metadata: { demo: "aethernet-settlement", scenario: summary.scenario },
    })
    if (!("status" in created) || !("id" in created)) return { taskId: null, note: "A2A task was not created" }

    await client.updateTaskStatus(created.id, {
      state: summary.outcome === "settled" ? "completed" : "rejected",
      timestamp: new Date().toISOString(),
    })
    return { taskId: created.id, note: null }
  } catch (error) {
    const code = error instanceof Error ? error.message : "unknown error"
    return { taskId: null, note: `Not recorded: ${code}` }
  }
}
