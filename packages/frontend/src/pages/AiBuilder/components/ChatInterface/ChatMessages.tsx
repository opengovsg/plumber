import { useState } from 'react'
import { Box, Flex, Image, ImageProps, Text, VStack } from '@chakra-ui/react'

import plumberLogo from '@/assets/plumber-logo.svg'
import { Message } from '@/hooks/useChatStream'
import { ChakraStreamdown } from '@/theme/components/Streamdown'

import ChatMessageToolbar from './ChatMessageToolbar'
import Loader from './Loader'

interface ChatMessagesProps {
  messages: Message[]
  currentResponse: string
  isStreaming: boolean
  messagesEndRef: React.RefObject<HTMLDivElement>
  messagesContainerRef: React.RefObject<HTMLDivElement>
  hasMessages: boolean
  onOpenDrawer: () => void
}

interface StreamingMessageProps {
  currentResponse: string
}

const PlumberAvatar = (props: ImageProps) => {
  return (
    <Image
      src={plumberLogo}
      alt="Plumber"
      boxSize={6}
      borderRadius="md"
      flexShrink={0}
      {...props}
    />
  )
}

const StreamingMessage = ({ currentResponse }: StreamingMessageProps) => (
  <Flex gap={3} w="full" align="start">
    <PlumberAvatar mt={1} />
    {currentResponse ? (
      <Box flex={1} color="gray.900">
        <ChakraStreamdown isAnimating={true}>
          {currentResponse}
        </ChakraStreamdown>
      </Box>
    ) : (
      <Loader />
    )}
  </Flex>
)

export default function ChatMessages({
  messages,
  currentResponse,
  isStreaming,
  messagesEndRef,
  messagesContainerRef,
  onOpenDrawer,
}: ChatMessagesProps) {
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null)

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
            <Box key={index}>
              {message.isUser ? (
                <Flex justify="flex-end">
                  <Box
                    maxW="80%"
                    bg="gray.100"
                    color="gray.900"
                    px={4}
                    py={3}
                    borderRadius="lg"
                  >
                    <Text fontSize="sm" whiteSpace="pre-wrap">
                      {message.text}
                    </Text>
                  </Box>
                </Flex>
              ) : (
                <Flex gap={3} w="full" align="start">
                  <PlumberAvatar mt={1} />
                  <Box flex={1} color="gray.900">
                    <ChakraStreamdown isAnimating={false}>
                      {message.text || ''}
                    </ChakraStreamdown>
                    <ChatMessageToolbar
                      message={message}
                      index={index}
                      copiedIndex={copiedIndex}
                      setCopiedIndex={setCopiedIndex}
                      onOpenDrawer={onOpenDrawer}
                    />
                  </Box>
                </Flex>
              )}
            </Box>
          ))}

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
