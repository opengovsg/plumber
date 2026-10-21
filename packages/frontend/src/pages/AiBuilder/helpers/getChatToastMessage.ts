import { z } from 'zod'

/**
 * Fallback when the chat transport surfaces a non-stream HTTP body we cannot
 * turn into a short user-facing string (e.g. raw JSON without an `error` field).
 * Keep in sync with AI_CHAT_GENERIC_ERROR_MESSAGE on the backend.
 */
export const AI_CHAT_GENERIC_TOAST_MESSAGE =
  'Something went wrong generating a response. Please try again.'

const httpErrorBodySchema = z.object({
  error: z.string().min(1),
})

/**
 * Turns useChat's onError value into toast copy.
 *
 * DefaultChatTransport puts the full HTTP response body into `error.message`
 * for pre-stream failures, so validation/403/500 responses arrive as JSON
 * strings. Prefer the body's `error` field; otherwise fall back to a generic
 * message for JSON dumps, or the message as-is for already-sanitized stream
 * errors from the backend.
 *
 * Returns '' when there is nothing to show (e.g. user abort).
 */
export function getChatToastMessage(error: Error): string {
  const raw = error.message.trim()
  if (!raw) {
    return ''
  }

  if (raw.startsWith('{')) {
    try {
      const parsed = httpErrorBodySchema.safeParse(JSON.parse(raw))
      if (parsed.success) {
        return parsed.data.error
      }
    } catch {
      // Not valid JSON — treat as an opaque dump below.
    }
    return AI_CHAT_GENERIC_TOAST_MESSAGE
  }

  return raw
}
