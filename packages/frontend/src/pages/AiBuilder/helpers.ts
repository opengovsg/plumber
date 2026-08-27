import { TextPart } from 'ai'

import {
  ClarificationPart,
  ColumnTablePart,
  CustomUIMessage,
  DynamicPickerPart,
  IsChatReadyPart,
  Message,
} from '@/hooks/useChatStream'

// Strip HTML comment blocks from AI chat text before display.
// Complete comments (<!-- ... -->) are invisible in HTML but some markdown parsers
// surface them as raw text. Incomplete comments that haven't reached --> yet
// (common mid-stream) are stripped so they never flash as visible content.
export const stripHtmlComments = (text: string): string =>
  text.replace(/<!--[\s\S]*?-->/g, '').replace(/<!--[\s\S]*$/, '')

// Ensure markdown headings are preceded by a newline so the parser treats them
// as block-level elements. Only fires when a heading marker immediately follows
// non-newline content (e.g. "text.##### Heading" → "text.\n##### Heading").
export const normalizeMarkdownHeadings = (text: string): string =>
  text.replace(/([^\n])(#{1,6} )/g, '$1\n$2')

export const prepareAiText = (text: string): string =>
  normalizeMarkdownHeadings(stripHtmlComments(text))

// First user message sent after connecting a form from the empty state.
// The parenthetical carries the connection id (for assigning the trigger in
// Phase 2b) and form id (for get_form_schema); it follows the same "(id: …)"
// convention as picker answers, so the chat display strips it (see
// formatUserMessageForDisplay) and the user only sees the form title. The
// exact shape is a contract with the system prompt's connect-first intake
// branch — change both together.
export const buildFormConnectedMessage = (
  formTitle: string,
  connectionId: string,
  formId: string | null,
): string => {
  const technicalRef = formId
    ? `(id: ${connectionId}, form id: ${formId})`
    : `(id: ${connectionId})`
  return `I've connected my FormSG form "${formTitle}" ${technicalRef}.`
}

export const buildKickoffMessage = (
  formTitle: string,
  connectionId: string,
  formId: string | null,
): string =>
  `${buildFormConnectedMessage(
    formTitle,
    connectionId,
    formId,
  )} Suggest workflows I can build with this form.`

// Sent when the user shares their form URL (url-only modal) without
// connecting it — the LLM's URL-first intake branch picks the URL up and
// fetches the public schema.
export const buildUrlSharedMessage = (formUrl: string): string =>
  `Here's my form: ${formUrl}.`

export const buildUrlSharedKickoffMessage = (formUrl: string): string =>
  `${buildUrlSharedMessage(formUrl)} Suggest workflows I can build with it.`

// Compact display label for a shared-but-not-connected form URL, e.g.
// "form.gov.sg/654ab1…f1e0" — used for the composer chip before the real
// form title is known (which requires a connection).
export const formatFormUrlLabel = (formUrl: string): string =>
  formUrl
    .replace(/^https:\/\//i, '')
    .replace(/([a-f0-9]{6})[a-f0-9]{14}([a-f0-9]{4})/i, '$1…$2')

// Pull the 24-hex-char form ID out of a FormSG connection screenName.
export const extractFormIdFromLabel = (label: string): string | null =>
  label.match(/[a-f0-9]{24}/i)?.[0] ?? null

// FormSG connection screenNames look like "[STAGING] [MRF] <24-hex-form-id> -
// <form title>". Drop the form-id segment for display; keep any env/MRF
// prefixes since they are informative.
export const stripFormIdPrefix = (label: string): string =>
  label.replace(/^((?:\[[A-Z]+\] )*)[a-f0-9]{24} - /i, '$1')

// User messages are displayed verbatim except for machine detail: picker
// answers and the kickoff message carry "(id: …)" / "(id: …, form id: …)"
// suffixes that are stripped from display. The wrapped value isn't always a
// hex UUID and could contain parens (e.g. an M365 column named "Score
// (out of 10)"), so match lazily up to whichever ")" is actually the
// terminator (followed by "." / whitespace / ":" / end-of-string — ":"
// covers the column-table reply format, which has "(id: …): <value>"
// immediately after the id, with multiple occurrences per message).
export const formatUserMessageForDisplay = (text: string): string =>
  text.replace(/ \(id: [\s\S]+?\)(?=[.\s:]|$)/g, '').trim()

// System signal for the LLM when a picker fetch has zero options — see
// DynamicPicker's onNoOptionsFound. Never shown to the user (isNoOptionsSignalMessage).
export const buildNoOptionsFoundMessage = (
  question: string,
  reason?: string,
): string =>
  `Q: ${question}\nA: [no options available${reason ? `: ${reason}` : ''}]`

// Shared answer format for a connection-picker turn — used both when the
// user picks an existing connection (see PromptInput's onSelect) and when
// they create one inline via AddAppConnection. Keep this in sync with the
// system prompt's picker-answer contract if the format ever changes.
export const buildPickerAnswerMessage = (
  question: string,
  label: string,
  connectionId: string,
): string => `Q: ${question}\nA: ${label} (id: ${connectionId})`

interface ConnectionMutationResult {
  id?: string
  formattedData?: Record<string, unknown>
}

// AddAppConnection's onClose hands back the raw accumulated response object
// from walking auth.authenticationSteps (createConnection's/verifyConnection's
// results, the submitted field values, etc.) rather than a clean (label, id)
// pair. Pull out what the chat answer needs: the new connection's id, and a
// display label.
//
// The label preference order matters: several apps' verifyCredentials
// derives or rewrites screenName from a live API call during verification —
// Slack/Telegram have no user-facing "Label" field at all (screenName comes
// entirely from the OAuth team name / bot's own name), and PaySG appends an
// env suffix ([LIVE]/[STAGING]) server-side. So the raw submitted
// fields.screenName is stale/wrong for those apps — the canonical label only
// exists on verifyConnection's returned formattedData once verification has
// run. createConnection's formattedData is checked as a fallback in case a
// future app's step sequence doesn't end in verifyConnection; fields.screenName
// and the caller-supplied app-name fallback cover apps with no auth-derived
// label at all.
export const extractConnectionResult = (
  response: Record<string, unknown>,
  fallbackLabel: string,
): { label: string; connectionId: string } | null => {
  const createConnectionResult = response.createConnection as
    | ConnectionMutationResult
    | undefined
  const connectionId = createConnectionResult?.id
  if (!connectionId) {
    return null
  }

  const verifyConnectionResult = response.verifyConnection as
    | ConnectionMutationResult
    | undefined
  const fields = response.fields as Record<string, unknown> | undefined

  const label =
    (verifyConnectionResult?.formattedData?.screenName as string | undefined) ??
    (createConnectionResult?.formattedData?.screenName as string | undefined) ??
    (fields?.screenName as string | undefined) ??
    fallbackLabel

  return { label, connectionId }
}

export const isNoOptionsSignalMessage = (text: string): boolean =>
  text.includes('\nA: [no options available')

// Matches FormSG share links across environments (form.gov.sg,
// staging.form.gov.sg, …) ending in a 24-hex-char form ID.
const FORM_URL_REGEX =
  /https:\/\/(?:[a-z0-9-]+\.)?form\.gov\.sg\/(?:[a-zA-Z0-9/]*\/)?[a-f0-9]{24}/gi

// Most recent FormSG URL mentioned anywhere in the conversation — used to
// prefill the "Add new form" modal's Form URL field.
export const extractLastFormUrl = (messages: Message[]): string | undefined => {
  for (let i = messages.length - 1; i >= 0; i--) {
    const matches = messages[i].text?.match(FORM_URL_REGEX)
    if (matches?.length) {
      return matches[matches.length - 1]
    }
  }
  return undefined
}

// Same base64 charset check as the backend's parseSecretKeyFormat (see
// formsg/auth/verify-credentials.ts) and AddFormsgConnectionModal's own
// SECRET_KEY_REGEX.
const FORMSG_SECRET_KEY_CHARSET_REGEX = /^[a-zA-Z0-9/+]+={0,2}$/

// A FormSG secret key is the base64 encoding of a 32-byte NaCl key. Checking
// the decoded byte length (not just the base64 charset) keeps ordinary
// words/IDs from false-positiving, since they're extremely unlikely to
// decode to exactly 32 bytes.
const isFormsgSecretKey = (token: string): boolean => {
  if (!FORMSG_SECRET_KEY_CHARSET_REGEX.test(token)) {
    return false
  }
  try {
    return atob(token).length === 32
  } catch {
    return false
  }
}

// GatherSG's instant-workflow trigger has an `encryptionKey` field (see
// encryptionKeySchema in gathersg/triggers/new-instant-workflow/schema.ts):
// 12-20 non-whitespace characters, at least one digit, one uppercase letter,
// and one special character.
const GATHERSG_ENCRYPTION_KEY_REGEX =
  /^(?=.*[0-9])(?=.*[A-Z])(?=.*[^A-Za-z0-9\s])\S{12,20}$/

// LetterSG, Postman-SMS, and PaySG API keys are a literal env prefix followed
// by a random token (see lettersg/common/api.ts's 'test_'/'live_' check,
// postman-sms/common/constants.ts's 'key_test_'/'key_live_' prefixes, and
// paysg/common/api.ts's 'paysg_live_'/'paysg_stag_' prefixes). None of these
// apps enforce a minimum key length server-side, so this matches on the
// prefix alone (plus at least one character after it) rather than guessing
// at a suffix length — accepting that ordinary words sharing a prefix (e.g.
// "test_case") will also match, since this is a soft warning, not a block.
const PREFIXED_API_KEY_REGEX =
  /^(?:key_test_|key_live_|paysg_live_|paysg_stag_|test_|live_)[A-Za-z0-9_-]+$/

// Telegram bot tokens aren't validated by Plumber's own schema (it's treated
// as free text), but the real tokens Telegram itself issues always follow
// this shape: a numeric bot id, a colon, then a 35-character alphanumeric
// string — e.g. "123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ1234567890abc".
const TELEGRAM_BOT_TOKEN_REGEX = /^\d{6,10}:[A-Za-z0-9_-]{35}$/

const SECRET_KEY_DETECTORS = [
  isFormsgSecretKey,
  (token: string) => GATHERSG_ENCRYPTION_KEY_REGEX.test(token),
  (token: string) => PREFIXED_API_KEY_REGEX.test(token),
  (token: string) => TELEGRAM_BOT_TOKEN_REGEX.test(token),
]

// Scans the message token-by-token (splitting on whitespace) against known
// secret/API key shapes from across the apps Plumber integrates with (FormSG,
// GatherSG, LetterSG, Postman-SMS, PaySG, Telegram), rather than requiring
// the whole message to be just the key — a user might paste it alongside
// other text (e.g. "here's my key: <pasted value>" or a key on its own line
// within a longer message). Used to warn before a user accidentally pastes a
// secret/API key into the chat composer instead of the app's own connection
// setup, since chat text is sent to the LLM.
export const containsSecretKey = (text: string): boolean =>
  text
    .split(/\s+/)
    .some(
      (token) =>
        token && SECRET_KEY_DETECTORS.some((isMatch) => isMatch(token)),
    )

// deduplicate messages by id
// there may be duplicates when the messages are combined
export const deduplicateMessages = (messages: Message[]) => {
  const seen = new Set()
  return messages.filter((msg) => {
    if (!msg.id || seen.has(msg.id)) {
      return false
    }
    seen.add(msg.id)
    return true
  })
}

// Extract text content from a UIMessage. A tool call splits generation into
// separate text parts (before/after), so join with a blank line rather than
// '' — otherwise the two chunks glue together mid-sentence. Empty parts are filtered
// out first so they don't inject a stray blank line.
export const extractTextContent = (msg: CustomUIMessage): string => {
  return msg.parts
    .filter(
      (part): part is TextPart =>
        part.type === 'text' && part.text.trim().length > 0,
    )
    .map((part) => part.text)
    .join('\n\n')
}

// Whether the assistant is mid-turn without producing visible text right now:
// the stream is still open but the newest part is a tool call, a step boundary,
// a data annotation, or the empty text part the AI SDK opens each generation
// step with. Callers use this to keep a loading indicator on screen during
// silent stretches — otherwise already-streamed markdown just freezes while a
// tool runs server-side.
export const isSilentStreamPhase = (msg: CustomUIMessage | undefined) => {
  const parts = msg?.parts
  if (!parts?.length) {
    return true
  }
  const lastPart = parts[parts.length - 1]
  return lastPart.type !== 'text' || lastPart.text.trim().length === 0
}

export const transformMessages = (messages: CustomUIMessage[]): Message[] => {
  let lastReadyIndex = -1

  const transformed = messages.map((msg, index) => {
    const isChatReady = msg.parts.find(
      (part): part is IsChatReadyPart => part.type === 'data-isChatReady',
    )?.data.isChatReady

    if (isChatReady) {
      lastReadyIndex = index
    }

    const clarificationPart = msg.parts.find(
      (part): part is ClarificationPart => part.type === 'data-clarification',
    )

    const dynamicPickerPart = msg.parts.find(
      (part): part is DynamicPickerPart => part.type === 'data-dynamicPicker',
    )

    const columnTablePart = msg.parts.find(
      (part): part is ColumnTablePart => part.type === 'data-columnTable',
    )

    return {
      id: msg.id,
      text: extractTextContent(msg),
      isUser: msg.role === 'user',
      traceId: msg.metadata?.traceId,
      isChatReady: false,
      clarification: clarificationPart?.data.questions,
      dynamicPicker: dynamicPickerPart?.data,
      columnTable: columnTablePart?.data,
    }
  })

  // Only set the last ready message to true
  if (lastReadyIndex !== -1) {
    transformed[lastReadyIndex].isChatReady = true
  }

  return transformed
}
