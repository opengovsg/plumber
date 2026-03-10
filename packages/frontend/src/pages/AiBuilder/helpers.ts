import { TextPart } from 'ai'

import { CustomUIMessage, Message } from '@/hooks/useChatStream'

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

export const transformMessages = (messages: CustomUIMessage[]) => {
  return messages.map((msg) => ({
    id: msg.id,
    text: extractTextContent(msg),
    isUser: msg.role === 'user',
    traceId: msg.metadata?.traceId,
  }))
}
