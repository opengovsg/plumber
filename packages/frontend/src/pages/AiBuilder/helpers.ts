import { TextPart } from 'ai'

import {
  CustomUIMessage,
  IsChatReadyPart,
  Message,
} from '@/hooks/useChatStream'

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
  let lastReadyIndex = -1

  const transformed = messages.map((msg, index) => {
    const isChatReady = msg.parts.find(
      (part): part is IsChatReadyPart => part.type === 'data-isChatReady',
    )?.data.isChatReady

    if (isChatReady) {
      lastReadyIndex = index
    }

    return {
      id: msg.id,
      text: extractTextContent(msg),
      isUser: msg.role === 'user',
      traceId: msg.metadata?.traceId,
      isChatReady: false, // default to false
    }
  })

  // Only set the last ready message to true
  if (lastReadyIndex !== -1) {
    transformed[lastReadyIndex].isChatReady = true
  }

  return transformed
}
