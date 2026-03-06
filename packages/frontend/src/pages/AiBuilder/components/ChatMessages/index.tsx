import { Box, Flex, VStack } from '@chakra-ui/react'

import { Message } from '@/hooks/useChatStream'

import ChatMessage from './ChatMessage'
import StreamingMessage from './StreamingMessage'

interface ChatMessagesProps {
  messages: Message[]
  currentResponse: string
  isStreaming: boolean
  messagesEndRef: React.RefObject<HTMLDivElement>
  messagesContainerRef: React.RefObject<HTMLDivElement>
}

export default function ChatMessages({
  messages,
  currentResponse,
  isStreaming,
  messagesEndRef,
  messagesContainerRef,
}: ChatMessagesProps) {
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

          {/* Streaming response */}
          {isStreaming && (
            <StreamingMessage currentResponse={currentResponse} />
          )}
        </VStack>
      </Box>
      <div ref={messagesEndRef} />
    </Flex>
  )
}
