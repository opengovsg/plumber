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
    .join('\n\n')
}

// Extract the generateWorkflow tool result from a UIMessage, if present
export const extractWorkflowToolResult = (msg: CustomUIMessage) => {
  for (const part of msg.parts) {
    if (
      part.type === 'tool-generateWorkflow' &&
      'state' in part &&
      part.state === 'output-available' &&
      'output' in part
    ) {
      return {
        ...(part.output as Record<string, unknown>),
        traceId: msg.metadata?.traceId || 'unknown_trace_id',
      }
    }
  }
  return null
}

export const transformMessages = (messages: CustomUIMessage[]) => {
  let lastWorkflowIndex = -1

  const transformed = messages.map((msg, index) => {
    const hasWorkflow = !!extractWorkflowToolResult(msg)

    if (hasWorkflow) {
      lastWorkflowIndex = index
    }

    return {
      id: msg.id,
      text: extractTextContent(msg),
      isUser: msg.role === 'user',
      traceId: msg.metadata?.traceId,
      hasWorkflow: false, // default to false
    }
  })

  // Only set the last workflow message to true
  if (lastWorkflowIndex !== -1) {
    transformed[lastWorkflowIndex].hasWorkflow = true
  }

  return transformed
}
