import { TextPart } from 'ai'

import {
  ClarificationPart,
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

// Accepts a FormSG share/admin URL in any supported environment, or a bare
// 24-hex-char form ID (both shapes work with get_form_schema).
export const isValidFormUrlInput = (input: string): boolean => {
  const trimmed = input.trim()
  return (
    /^[a-f0-9]{24}$/i.test(trimmed) ||
    /^https:\/\/(?:[a-z0-9-]+\.)?form\.gov\.sg\/(?:[a-zA-Z0-9/]*\/)?[a-f0-9]{24}\/?$/i.test(
      trimmed,
    )
  )
}

// Bare 24-hex form IDs become a full prod share URL so everything downstream
// (extractLastFormUrl, the forced key card, modal prefill) sees one shape.
export const normalizeFormUrlInput = (input: string): string => {
  const trimmed = input.trim()
  return /^[a-f0-9]{24}$/i.test(trimmed)
    ? `https://form.gov.sg/${trimmed}`
    : trimmed
}

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
// suffixes that are stripped from display.
export const formatUserMessageForDisplay = (text: string): string =>
  text.replace(/ \(id: [a-f0-9-]+(?:, form id: [a-f0-9]+)?\)/g, '').trim()

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

// Helper function to extract text content from UIMessage
export const extractTextContent = (msg: CustomUIMessage): string => {
  return msg.parts
    .filter((part) => part.type === 'text')
    .map((part: TextPart) => part.text)
    .join('')
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

    return {
      id: msg.id,
      text: extractTextContent(msg),
      isUser: msg.role === 'user',
      traceId: msg.metadata?.traceId,
      isChatReady: false,
      clarification: clarificationPart?.data.questions,
      dynamicPicker: dynamicPickerPart?.data,
    }
  })

  // Only set the last ready message to true
  if (lastReadyIndex !== -1) {
    transformed[lastReadyIndex].isChatReady = true
  }

  return transformed
}
