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
