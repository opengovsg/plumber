import { useEffect, useState } from 'react'
import { Box, Flex, VStack } from '@chakra-ui/react'

import { Message } from '@/hooks/useChatStream'

import ChatMessage from './ChatMessage'
import PreviewStepsButton from './PreviewStepsButton'
import StreamingMessage from './StreamingMessage'

interface ChatMessagesProps {
  messages: Message[]
  currentResponse: string
  isStreaming: boolean
  messagesEndRef: React.RefObject<HTMLDivElement>
  messagesContainerRef: React.RefObject<HTMLDivElement>
  hasMessages: boolean
  onOpenDrawer: () => void
}

export default function ChatMessages({
  messages,
  currentResponse,
  isStreaming,
  messagesEndRef,
  messagesContainerRef,
  hasMessages,
  onOpenDrawer,
}: ChatMessagesProps) {
  const [isReadyForPreview, setIsReadyForPreview] = useState(false)

  useEffect(() => {
    const checkReadiness = async () => {
      if (isStreaming || messages.length === 0) {
        setIsReadyForPreview(false)
        return
      }

      const lastMessage = messages[messages.length - 1]

      try {
        const response = await fetch('/api/chat/readiness', {
          method: 'POST',
          body: JSON.stringify({ message: lastMessage.text }),
          headers: {
            'Content-Type': 'application/json',
          },
        })

        const result = await response.json()
        setIsReadyForPreview(result.isReady)
      } catch {
        setIsReadyForPreview(false)
      }
    }

    checkReadiness()
  }, [isStreaming, messages])

  // Scroll to bottom when PreviewStepsButton appears
  useEffect(() => {
    if (isReadyForPreview) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [isReadyForPreview, messagesEndRef])

  return (
    <Flex
      ref={messagesContainerRef}
      flex={1}
      flexDir="column"
      overflowY="auto"
      w="full"
    >
      <Box w="full" maxW="4xl" mx="auto" px={4} py={6}>
        <VStack align="stretch" spacing={4}>
          {messages.map((message, index) => (
            <ChatMessage key={index} message={message} />
          ))}

          {hasMessages && !isStreaming && isReadyForPreview && (
            <PreviewStepsButton
              messages={messages}
              onOpenDrawer={onOpenDrawer}
            />
          )}

          {/* Streaming response */}
          {isStreaming && (
            <StreamingMessage currentResponse={currentResponse} />
          )}

          <div ref={messagesEndRef} />
        </VStack>
      </Box>
    </Flex>
  )
}
