import type { ChatRequest } from './schema'

/**
 * Serializes chat messages into a format suitable for Langfuse tracing.
 * Extracts text content from message parts and joins with newlines.
 */
export function serializeMessagesForLangfuse(
  messages: ChatRequest['messages'],
): Array<{ role: string; content: string }> {
  return messages.map((m) => ({
    role: m.role,
    content: m.parts
      .map((p) => {
        if (p.type === 'text') {
          return p.text
        }
        return ''
      })
      .join('\n'),
  }))
}

export interface EstablishedFormConnection {
  connectionId: string
  formId?: string
  formTitle: string
}

// Matches the exact text sent by AiBuilder/helpers.ts's buildFormConnectedMessage/
// buildKickoffMessage on the frontend (both the connect-first opening message and
// the mid-conversation form-connected message use this same shape).
const CONNECTED_FORM_MESSAGE_REGEX =
  /I've connected my FormSG form "([^"]+)" \(id: ([^\s,)]+)(?:, form id: ([0-9a-f]{24}))?\)/i

/**
 * Finds the most recently established FormSG connection referenced anywhere
 * in the conversation, by scanning for the `(id: …)` convention rather than
 * relying on the LLM to recall a fact from many turns back. Used to inject a
 * server-derived reminder into the system prompt every turn, since the LLM's
 * own recall of this fact degrades over a long conversation even though the
 * original message survives unmodified in every request.
 */
export function extractEstablishedFormConnection(
  messages: ChatRequest['messages'],
): EstablishedFormConnection | null {
  let latest: EstablishedFormConnection | null = null

  for (const message of messages) {
    if (message.role !== 'user') {
      continue
    }
    for (const part of message.parts) {
      if (part.type !== 'text') {
        continue
      }
      const match = part.text.match(CONNECTED_FORM_MESSAGE_REGEX)
      if (match) {
        latest = {
          formTitle: match[1],
          connectionId: match[2],
          formId: match[3],
        }
      }
    }
  }

  return latest
}

/**
 * Builds a short reminder appended to the system prompt when a FormSG
 * connection was already established earlier in the conversation. This is
 * re-derived fresh on every request (see extractEstablishedFormConnection),
 * so the fact stays visible near generation time regardless of how many
 * turns have elapsed since it was first mentioned.
 */
export function buildEstablishedConnectionReminder(
  connection: EstablishedFormConnection | null,
): string {
  if (!connection) {
    return ''
  }

  const formRef = connection.formId ? ` (form id "${connection.formId}")` : ''

  return `\n\nKnown fact, verified server-side just now — not from your own memory of earlier turns: the user already connected FormSG connection_id "${connection.connectionId}"${formRef} for the form "${connection.formTitle}" earlier in this conversation. When assigning this trigger's connection in Phase 2b step a, use this connection_id directly via update_step_parameters with parameter_labels: { "connection_id": "${connection.formTitle}" }. Do NOT emit a connection picker, do NOT say the form's URL is known but unconnected, and do NOT ask for a secret key for this trigger — this connection is already fully verified.`
}
