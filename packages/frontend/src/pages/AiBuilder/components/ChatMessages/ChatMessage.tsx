import { memo } from 'react'
import { Box, Flex, Text } from '@chakra-ui/react'

import { Message } from '@/hooks/useChatStream'
import { ChakraStreamdown } from '@/theme/components/Streamdown'

import ChatMessageToolbar from './ChatMessageToolbar'
import PlumberAvatar from './PlumberAvatar'

interface ChatMessageProps {
  message: Message
}

const AiMessage = memo(({ message }: ChatMessageProps) => {
  return (
    <Flex gap={3} w="full" align="start">
      <PlumberAvatar mt={3} />
      <Box flex={1} color="gray.900">
        <ChakraStreamdown isAnimating={false}>
          {message.text || ''}
        </ChakraStreamdown>
        <ChatMessageToolbar traceId={message.traceId || ''} />
      </Box>
    </Flex>
  )
})

AiMessage.displayName = 'AiMessage'

const UserMessage = memo(({ message }: ChatMessageProps) => {
  return (
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
  )
})

UserMessage.displayName = 'UserMessage'

const ChatMessage = memo(({ message }: { message: Message }) => {
  if (message.isUser) {
    return <UserMessage message={message} />
  }
  return <AiMessage message={message} />
})

ChatMessage.displayName = 'ChatMessage'

export default ChatMessage
