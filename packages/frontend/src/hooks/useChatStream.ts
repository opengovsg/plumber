import { useCallback, useMemo } from 'react'
import type { UIMessage as AIMessage } from '@ai-sdk/react'
import { useChat } from '@ai-sdk/react'
import { useToast } from '@opengovsg/design-system-react'
import { DefaultChatTransport } from 'ai'

export interface Message {
  text: string
  traceId?: string
  generationId?: string
  isUser: boolean
}

export function useChatStream() {
  const toast = useToast()
  const {
    messages: aiMessages,
    sendMessage,
    status,
    error: aiError,
    stop,
  } = useChat({
    transport: new DefaultChatTransport({
      api: '/api/chat',
      credentials: 'include',
      prepareSendMessagesRequest: ({ messages }) => {
        // Send all messages to maintain conversation context
        const body = {
          messages: messages,
          userId: 'user-123',
          sessionId: 'session-456',
        }
        return { body }
      },
    }),
    onError: (error: Error) => {
      toast({
        title: 'Error: ' + error.message,
        status: 'error',
        duration: 3000,
        isClosable: true,
        position: 'top',
      })
    },
  })

  // Helper function to extract text content from UIMessage
  const extractTextContent = useCallback((msg: AIMessage): string => {
    return msg.parts
      .filter((part) => part.type === 'text')
      .map((part) => (part as any).text)
      .join('')
  }, [])

  // Transform AI SDK messages to our Message format
  const messages = useMemo<Message[]>(() => {
    const isActivelyStreaming = status === 'streaming' || status === 'submitted'

    // Filter user and assistant messages
    let messagesToTransform = aiMessages.filter(
      (msg) => msg.role === 'user' || msg.role === 'assistant',
    )

    // If streaming, exclude the last assistant message (shown via currentResponse)
    if (isActivelyStreaming && messagesToTransform.length > 0) {
      const lastMsg = messagesToTransform[messagesToTransform.length - 1]
      if (lastMsg.role === 'assistant') {
        messagesToTransform = messagesToTransform.slice(0, -1)
      }
    }

    return messagesToTransform.map((msg: AIMessage) => ({
      text: extractTextContent(msg),
      isUser: msg.role === 'user',
      traceId: undefined,
      generationId: undefined,
    }))
  }, [aiMessages, extractTextContent, status])

  // Get the current streaming response (last assistant message that's still being streamed)
  const currentResponse = useMemo(() => {
    const isActivelyStreaming = status === 'streaming' || status === 'submitted'

    if (!isActivelyStreaming) {
      return ''
    }

    const lastMessage = aiMessages[aiMessages.length - 1]
    if (lastMessage && lastMessage.role === 'assistant') {
      return extractTextContent(lastMessage)
    }
    return ''
  }, [aiMessages, status, extractTextContent])

  // Wrapper for sendMessage that matches the expected signature
  const sendMessageWrapper = useCallback(
    (userPrompt: string) => {
      sendMessage({
        role: 'user',
        parts: [{ type: 'text', text: userPrompt }],
      })
    },
    [sendMessage],
  )

  const cancelStream = useCallback(() => {
    stop()
  }, [stop])

  return {
    messages,
    currentResponse,
    isStreaming: status === 'submitted' || status === 'streaming',
    error: aiError?.message || null,
    sendMessage: sendMessageWrapper,
    cancelStream,
  }
}
