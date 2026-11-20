/**
 * Caller-side helpers: build the exact bodies Kronova verifies and sign them.
 * Used by tests and the keygen script; customers can copy the same logic into any language.
 */

import { signDetached } from "./crypto"
import { PQC_ALG, signingBytes, type PqcDomain, type PqcSignature } from "./envelope"

export async function signEnvelope(
  domain: PqcDomain,
  body: unknown,
  keyId: string,
  privateKeyB64: string,
  signedAt = new Date().toISOString(),
): Promise<PqcSignature> {
  const signature = await signDetached(signingBytes(domain, keyId, signedAt, body), privateKeyB64)
  return { alg: PQC_ALG, keyId, signedAt, signature }
}

/** The body signed for an A2A message, built from the message after Kronova normalization (parts use `type`). */
export function a2aMessageBody(message: {
  messageId: string
  role: string
  parts: unknown[]
  contextId?: string
  referenceTaskIds?: string[]
}) {
  return {
    messageId: message.messageId,
    role: message.role,
    parts: message.parts,
    contextId: message.contextId ?? null,
    referenceTaskIds: message.referenceTaskIds ?? [],
  }
}

/** The body signed for an AetherNet message sent through the aethernet_p2p_communication skill. */
export function aethernetMessageBody(input: {
  source_agent_id: string
  target_agent_id: string
  message_type: string
  payload?: unknown
}) {
  return {
    sourceAgentId: input.source_agent_id,
    targetAgentId: input.target_agent_id,
    messageType: input.message_type,
    payload: input.payload ?? {},
  }
}

/** The body signed to prove possession when registering a public key. */
export function keyRegistrationBody(publicKey: string) {
  return { publicKey }
}
