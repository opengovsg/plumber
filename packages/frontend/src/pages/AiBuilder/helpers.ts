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
