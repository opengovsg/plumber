import { parsePipeId, readLastPipeSubject, type PipeId } from '@plumber/shared'

import type Flow from '@/models/flow'
import type User from '@/models/user'
import { listConnectionsService } from '@/services/mcp/list-connections'

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

/**
 * Removes echoed reasoning parts from client messages.
 *
 * Anthropic binds each thinking signature to the tools list and prompt of the
 * request that created it. Both change between turns, so replaying them fails.
 */
export function stripReasoningParts(
  messages: ChatRequest['messages'],
): ChatRequest['messages'] {
  return messages.map((m) => ({
    ...m,
    parts: m.parts.filter((p) => p.type !== 'reasoning'),
  }))
}

export interface EstablishedFormConnection {
  connectionId: string
  formId?: string
  formTitle: string
}

interface CandidateFormConnectionRef {
  connectionId: string
  formId?: string
}

// Matches the shape sent by AiBuilder/helpers.ts's buildFormConnectedMessage/
// buildKickoffMessage on the frontend (both the connect-first opening message
// and the mid-conversation form-connected message use this same shape). The
// quoted form title is matched but deliberately not captured — it's raw user
// text and must never be trusted or echoed back into the system prompt as if
// it were a verified fact (see resolveEstablishedFormConnection).
const CONNECTED_FORM_MESSAGE_REGEX =
  /I've connected my FormSG form "[^"]+" \(id: ([^\s,)]+)(?:, form id: ([0-9a-f]{24}))?\)/i

/**
 * Finds the most recently referenced FormSG connection id in the
 * conversation, by scanning for the `(id: …)` convention rather than relying
 * on the LLM to recall a fact from many turns back. This is only a
 * candidate: the id is entirely user-supplied text at this point and has not
 * been checked against the database — a user could reference an arbitrary
 * connectionId (their own or someone else's) here. Callers must verify
 * ownership via resolveEstablishedFormConnection before treating this as a
 * fact to hand to the LLM.
 */
export function extractCandidateFormConnection(
  messages: ChatRequest['messages'],
): CandidateFormConnectionRef | null {
  let latest: CandidateFormConnectionRef | null = null

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
        latest = { connectionId: match[1], formId: match[2] }
      }
    }
  }

  return latest
}

/**
 * Verifies a candidate FormSG connection id actually belongs to this user
 * (and is a verified formsg connection) before it's ever surfaced to the LLM
 * as an established fact. Re-derived fresh on every request from the raw
 * message text — not from the LLM's own recall — so the fact stays visible
 * near generation time regardless of how many turns have elapsed since it
 * was first mentioned, without trusting anything the user hasn't actually
 * verified access to. The connection's real label (from the database, set at
 * connection-verification time) is used for the reminder rather than the
 * user-supplied form title text, so a crafted title can't be echoed back
 * into the system prompt as if it were server-verified.
 */
export async function resolveEstablishedFormConnection(
  user: User,
  messages: ChatRequest['messages'],
): Promise<EstablishedFormConnection | null> {
  const candidate = extractCandidateFormConnection(messages)
  if (!candidate) {
    return null
  }

  const connections = await listConnectionsService(user, 'formsg')
  const verified = connections.find(
    (c) => c.id === candidate.connectionId && c.verified,
  )
  if (!verified) {
    return null
  }

  return {
    connectionId: verified.id,
    formId: candidate.formId,
    formTitle: verified.label,
  }
}

/**
 * Builds a short reminder appended to the system prompt when a FormSG
 * connection was already established earlier in the conversation. Only ever
 * called with output from resolveEstablishedFormConnection, so the fields
 * here are already verified as belonging to this user.
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

export async function loadPipeForChatPreview(
  user: User,
  pipeId: string,
): Promise<Flow | null> {
  const parsed = parsePipeId(pipeId)
  if (!parsed) {
    return null
  }

  const row = await user
    .withAccessibleFlows({ requiredRole: 'editor' })
    .findOne({ 'flows.id': parsed })

  return row ?? null
}

// IMPORTANT: Never put the pipe name in the reminder. The name is free text any editor can set.
const VERIFIED_PREFIX =
  '\n\nKnown fact, verified server-side just now. Trust this over your memory of earlier turns. '

function editablePipeReminder(pipeId: PipeId, published: boolean): string {
  const publishedNote = published
    ? ' This pipe is published. Step changes fail until the user confirms and you call unpublish_pipe.'
    : ''
  return `${VERIFIED_PREFIX}The user selected pipe_id "${pipeId}" as the subject of this chat, and they can edit it. Call get_flow with that pipe_id before any change. Use the existing pipe tools. Call create_pipe only when the user asks for a new pipe.${publishedNote}`
}

function refusalReminder(pipeId: PipeId): string {
  return `${VERIFIED_PREFIX}The user referenced pipe_id "${pipeId}". It is not a pipe they can edit. Do not call any tool with that id. Tell the user you cannot open that pipe and ask them to choose another or describe a new workflow.`
}

function toSubjectEntries(messages: ChatRequest['messages']) {
  return messages.flatMap((message) =>
    message.parts.flatMap((part) =>
      part.type === 'text' ? [{ author: message.role, text: part.text }] : [],
    ),
  )
}

// Later turns must not re-seed, or the preview reverts after create_pipe.
function isSelectionTurn(
  messages: ChatRequest['messages'],
  pipeId: PipeId,
): boolean {
  const latestUserMessage = [...messages]
    .reverse()
    .find((message) => message.role === 'user')
  if (!latestUserMessage) {
    return false
  }
  return (
    readLastPipeSubject(toSubjectEntries([latestUserMessage]))?.pipeId ===
    pipeId
  )
}

export async function establishPipeSubject(
  user: User,
  messages: ChatRequest['messages'],
): Promise<{ reminder: string; seedPipeId: PipeId | null }> {
  const subject = readLastPipeSubject(toSubjectEntries(messages))
  if (!subject) {
    return { reminder: '', seedPipeId: null }
  }

  const row = await loadPipeForChatPreview(user, subject.pipeId)
  if (!row) {
    return { reminder: refusalReminder(subject.pipeId), seedPipeId: null }
  }

  return {
    reminder: editablePipeReminder(subject.pipeId, row.active === true),
    seedPipeId: isSelectionTurn(messages, subject.pipeId)
      ? subject.pipeId
      : null,
  }
}
