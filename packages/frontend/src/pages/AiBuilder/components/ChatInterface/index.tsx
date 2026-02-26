import { useEffect, useRef, useState } from 'react'
import { IoChevronDown } from 'react-icons/io5'
import { Box, Flex, IconButton, Text } from '@chakra-ui/react'

import { useChatStream } from '@/hooks/useChatStream'
import ChatMessages from '@/pages/AiBuilder/components/ChatMessages'

import { useAiBuilderContext } from '../../AiBuilderContext'

import PromptInput from './PromptInput'

export default function ChatInterface() {
  const { ddSessionId } = useAiBuilderContext()
  const { messages, currentResponse, isStreaming, sendMessage, cancelStream } =
    useChatStream({ ddSessionId })
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const messagesContainerRef = useRef<HTMLDivElement>(null)
  const [showScrollButton, setShowScrollButton] = useState(false)

  // Check if user is near bottom of scroll
  useEffect(() => {
    const container = messagesContainerRef.current
    if (!container) {
      return
    }

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container
      const isNearBottom = scrollHeight - scrollTop - clientHeight < 100
      setShowScrollButton(!isNearBottom && scrollHeight > clientHeight)
    }

    container.addEventListener('scroll', handleScroll)
    // Check initially and on content changes
    handleScroll()

    return () => container.removeEventListener('scroll', handleScroll)
  }, [messages, currentResponse])

  // Auto-scroll to bottom when new messages arrive (only if already at bottom)
  useEffect(() => {
    const container = messagesContainerRef.current
    if (!container) {
      return
    }

    const { scrollTop, scrollHeight, clientHeight } = container
    const isNearBottom = scrollHeight - scrollTop - clientHeight < 100

    if (isNearBottom) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages, currentResponse])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  const hasMessages = messages.length > 0 || isStreaming

  const handleOpenPreview = () => {
    // TODO: implement steps preview
  }

  // Initial empty state - centered layout
  if (!hasMessages) {
    return (
      <Flex
        h="100%"
        w="full"
        flexDir="column"
        alignItems="center"
        justifyContent="center"
        gap="1.5rem"
        px={4}
      >
        {messages.length === 0 && (
          <Text textStyle="h3">What happens in your workflow?</Text>
        )}
        <Box w="full" maxW="2xl" overflowY="auto" maxH="100vh">
          <PromptInput
            sendMessage={sendMessage}
            isStreaming={isStreaming}
            cancelStream={cancelStream}
            showIdeas={true}
            placeholder="Tell us step-by-step what happens in your workflow"
          />
        </Box>
      </Flex>
    )
  }

  // Chat layout - messages with input at bottom
  return (
    <Flex h="100%" w="full" position="relative">
      {/* Main Chat Area */}
      <Flex
        h="100%"
        w="100%"
        flexDir="column"
        transition="width 0.3s ease-in-out"
        position="relative"
      >
        {/* Messages Area */}
        <ChatMessages
          messages={messages}
          currentResponse={currentResponse}
          isStreaming={isStreaming}
          messagesEndRef={messagesEndRef}
          messagesContainerRef={messagesContainerRef}
          hasMessages={hasMessages}
          onOpenDrawer={handleOpenPreview}
        />

        {/* Input Area - Fixed at bottom */}
        <Box
          borderTop="1px"
          borderColor="gray.200"
          bg="white"
          w="full"
          position="relative"
        >
          {/* Scroll to Bottom Button */}
          {showScrollButton && (
            <IconButton
              aria-label="Scroll to bottom"
              variant="clear"
              icon={<IoChevronDown />}
              onClick={scrollToBottom}
              size="xs"
              borderRadius="full"
              border="1px"
              bg="white"
              _hover={{
                bg: 'interaction.muted.neutral.hover',
              }}
              position="absolute"
              top="-56px"
              left="50%"
              transform="translateX(-50%)"
              zIndex={10}
              boxShadow="md"
            />
          )}
          <Box maxW="4xl" mx="auto" p={4}>
            <PromptInput
              sendMessage={sendMessage}
              isStreaming={isStreaming}
              cancelStream={cancelStream}
            />
          </Box>
        </Box>
      </Flex>

      {/* TODO: Add Side Drawer */}
    </Flex>
  )
}
