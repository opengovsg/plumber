import { memo } from 'react'
import { Box, Flex, Text } from '@chakra-ui/react'

import { Message } from '@/hooks/useChatStream'
import {
  formatUserMessageForDisplay,
  isNoOptionsSignalMessage,
  prepareAiText,
} from '@/pages/AiBuilder/helpers'
import { ChakraStreamdown } from '@/theme/components/Streamdown'

import ChatMessageToolbar from './ChatMessageToolbar'

interface ChatMessageProps {
  message: Message
  shouldShowPreview?: boolean
  shouldShowToolbar?: boolean
}

const AiMessage = memo(
  ({ message, shouldShowPreview, shouldShowToolbar }: ChatMessageProps) => {
    return (
      <Flex gap={3} w="full" align="start">
        <Box flex={1} px={2} pt={5} pb={2} color="gray.900">
          <ChakraStreamdown isAnimating={false}>
            {prepareAiText(message.text || '')}
          </ChakraStreamdown>
          {shouldShowToolbar && (
            <ChatMessageToolbar
              traceId={message.traceId || ''}
              shouldShowPreviewButton={shouldShowPreview}
            />
          )}
        </Box>
      </Flex>
    )
  },
)

AiMessage.displayName = 'AiMessage'

const UserMessage = memo(({ message }: ChatMessageProps) => {
  const displayText = formatUserMessageForDisplay(message.text)
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
        <Text whiteSpace="pre-wrap">{displayText}</Text>
      </Box>
    </Flex>
  )
})

UserMessage.displayName = 'UserMessage'

const ChatMessage = memo(
  ({
    message,
    shouldShowPreview,
    shouldShowToolbar,
  }: {
    message: Message
    shouldShowPreview: boolean
    shouldShowToolbar: boolean
  }) => {
    if (message.isUser) {
      // System cue for the LLM, not a real user reply — never rendered.
      if (isNoOptionsSignalMessage(message.text)) {
        return null
      }
      return <UserMessage message={message} />
    }
    return (
      <AiMessage
        message={message}
        shouldShowPreview={shouldShowPreview}
        shouldShowToolbar={shouldShowToolbar}
      />
    )
  },
)

ChatMessage.displayName = 'ChatMessage'

export default ChatMessage
