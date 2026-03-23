import { Fragment } from 'react'
import { Box, VStack } from '@chakra-ui/react'
import { useIsMobile } from '@opengovsg/design-system-react'
import { StickToBottom } from 'use-stick-to-bottom'

import { Message } from '@/hooks/useChatStream'

import ChatMessage, { WarningMessage } from './ChatMessage'
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
  const isMobile = useIsMobile()

  return (
    <StickToBottom.Content
      style={{
        flex: 1,
        overflowY: 'auto',
        minHeight: 0,
      }}
    >
      <Box w="full" maxW="3xl" mx="auto" px={4} py={6}>
        <VStack align="stretch" spacing={4}>
          {messages.map((message, index) => {
            const shouldShowPreview = isMobile && message.hasWorkflow
            const isLast = index === messages.length - 1
            const isFirst = index === 0
            return (
              <Fragment key={message.id}>
                <ChatMessage
                  message={message}
                  shouldShowPreview={shouldShowPreview}
                  shouldShowToolbar={isLast}
                />
                {isFirst && <WarningMessage />}
              </Fragment>
            )
          })}

          {/* Streaming response */}
          {isStreaming && (
            <StreamingMessage currentResponse={currentResponse} />
          )}
        </VStack>
      </Box>
    </StickToBottom.Content>
  )
}
