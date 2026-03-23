import { useCallback, useEffect } from 'react'
import { Box, Flex, Text } from '@chakra-ui/react'
import { StickToBottom } from 'use-stick-to-bottom'

import { Message } from '@/hooks/useChatStream'
import { useAiBuilderContext } from '@/pages/AiBuilder/AiBuilderContext'
import ChatMessages from '@/pages/AiBuilder/components/ChatMessages'
import { PLACEHOLDER_MESSAGES } from '@/pages/AiBuilder/constants'

import MessageLimitBanner from './MessageLimitBanner'
import PromptInput from './PromptInput'
import ScrollButton from './ScrollButton'
import SideDrawer from './SideDrawer'

interface ChatInterfaceProps {
  messages: Message[]
  currentResponse: string
  isStreaming: boolean
  sendMessage: (message: string) => void
  cancelStream: () => void
  resetChat: () => void
  hasReachedLimit: boolean
}

export default function ChatInterface(props: ChatInterfaceProps) {
  const {
    messages,
    currentResponse,
    isStreaming,
    sendMessage,
    cancelStream,
    resetChat,
    hasReachedLimit,
  } = props
  const {
    chatInput,
    output,
    isMobile,
    isDrawerOpen,
    setIsDrawerOpen,
    setChatInput,
    setChatMessages,
    setFlowName,
    setOutput,
  } = useAiBuilderContext()

  const hasMessages = messages.length > 0 || isStreaming

  const handleNewChat = useCallback(() => {
    cancelStream()
    resetChat()
    setIsDrawerOpen(false)

    // Extract continuation prompt from the last assistant message (between first pair of triple backticks)
    const lastMessage = messages[messages.length - 1]
    const match = lastMessage?.text?.match(/```\n([\s\S]*?)\n```/)
    const continuationPrompt = match ? match[1].trim() : ''

    setChatInput(continuationPrompt)
    setChatMessages([])
    setFlowName('Build with AI')
    setOutput(null)
  }, [
    cancelStream,
    resetChat,
    setIsDrawerOpen,
    setChatInput,
    setChatMessages,
    setFlowName,
    setOutput,
    messages,
  ])

  const handleOpenPreview = useCallback(() => {
    if (chatInput !== messages[messages.length - 1]?.text) {
      setChatInput(messages[messages.length - 1].text)
      setChatMessages(messages)
    }

    if (!isMobile) {
      setIsDrawerOpen(true)
    }
  }, [
    chatInput,
    messages,
    setChatInput,
    setChatMessages,
    setIsDrawerOpen,
    isMobile,
  ])

  // Auto-open preview when streaming completes and output is available
  useEffect(() => {
    if (hasMessages && !isStreaming && !!output) {
      handleOpenPreview()
    }
  }, [isStreaming, hasMessages, output, handleOpenPreview])

  if (!hasMessages) {
    return (
      <Flex
        h="100%"
        w="full"
        flexDir="column"
        alignItems="center"
        justifyContent="center"
        px={4}
      >
        <Flex flexDir="column" gap="1.5rem" w="full" maxW="2xl">
          <Text textStyle="h3" textAlign="left">
            What do you want to automate?
          </Text>
          <PromptInput
            sendMessage={sendMessage}
            isStreaming={isStreaming}
            cancelStream={cancelStream}
            showIdeas
            initialValue={chatInput}
            placeholder={
              PLACEHOLDER_MESSAGES[Date.now() % PLACEHOLDER_MESSAGES.length]
            }
          />
        </Flex>
      </Flex>
    )
  }

  return (
    <Flex h="100%" w="full" position="relative" overflow="hidden">
      <Flex
        h="100%"
        w="full"
        flexDir="column"
        position="relative"
        pr={isDrawerOpen && !isMobile ? '50%' : '0'}
        transition="padding-right 0.3s ease-in-out"
      >
        <StickToBottom
          resize="smooth"
          initial="smooth"
          style={{
            display: 'flex',
            height: '100%',
            width: '100%',
            flexDirection: 'column',
            position: 'relative',
          }}
        >
          <ChatMessages
            messages={messages}
            currentResponse={currentResponse}
            isStreaming={isStreaming}
          />

          <Box
            borderTop="1px"
            borderColor="gray.200"
            bg="white"
            w="full"
            flexShrink={0}
            position="relative"
          >
            <Box
              maxW="3xl"
              mx="auto"
              px={4}
              py={4}
              gap={4}
              display="flex"
              flexDirection="column"
            >
              <ScrollButton />
              {hasReachedLimit ? (
                <MessageLimitBanner onNewChat={handleNewChat} />
              ) : (
                <PromptInput
                  sendMessage={sendMessage}
                  isStreaming={isStreaming}
                  cancelStream={cancelStream}
                />
              )}
              {!isMobile && (
                <Text
                  textStyle="caption-1"
                  color="interaction.support.placeholder"
                  textAlign="center"
                >
                  This feature is new and still improving. It can make mistakes.
                </Text>
              )}
            </Box>
          </Box>
        </StickToBottom>
      </Flex>

      <SideDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
      />
    </Flex>
  )
}
