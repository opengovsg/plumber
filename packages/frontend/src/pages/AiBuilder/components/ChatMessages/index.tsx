import { Box, VStack } from '@chakra-ui/react'
import { StickToBottom } from 'use-stick-to-bottom'

import { Message } from '@/hooks/useChatStream'

import ChatMessage from './ChatMessage'
import StreamingMessage from './StreamingMessage'

interface ChatMessagesProps {
  messages: Message[]
  currentResponse: string
  isStreaming: boolean
}

export default function ChatMessages({
  messages,
  currentResponse,
  isStreaming,
}: ChatMessagesProps) {
  return (
    <StickToBottom.Content
      style={{
        flex: 1,
        overflowY: 'auto',
        minHeight: 0,
      }}
    >
      <Box w="full" maxW="4xl" mx="auto" px={4} py={6}>
        <VStack align="stretch" spacing={4}>
          {messages.map((message, index) => (
            <ChatMessage key={index} message={message} />
          ))}

          {/* Streaming response */}
          {isStreaming && (
            <StreamingMessage currentResponse={currentResponse} />
          )}
        </VStack>
      </Box>
    </StickToBottom.Content>
  )
}
