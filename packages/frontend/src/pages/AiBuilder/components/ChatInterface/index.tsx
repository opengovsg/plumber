import { useCallback, useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Box, Flex, Text } from '@chakra-ui/react'
import { StickToBottom } from 'use-stick-to-bottom'

import * as URLS from '@/config/urls'
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
  isReadyForPreview: boolean
  sendMessage: (message: string) => void
  cancelStream: () => void
  resetChat: () => void
  hasReachedLimit: boolean
  onAddConnection?: (context: { question: string }) => void
  knownFormUrl?: string
  onConnectForm?: () => void
  attachedForm?: { label: string; isConnected?: boolean } | null
}

export default function ChatInterface(props: ChatInterfaceProps) {
  const {
    messages,
    currentResponse,
    isStreaming,
    isReadyForPreview,
    sendMessage,
    cancelStream,
    resetChat,
    hasReachedLimit,
    onAddConnection,
    knownFormUrl,
    onConnectForm,
    attachedForm,
  } = props
  const navigate = useNavigate()
  const location = useLocation()
  const { chatInput, isMobile, isDrawerOpen, setIsDrawerOpen, setChatState } =
    useAiBuilderContext()

  const hasMessages = messages.length > 0 || isStreaming

  const lastMessage = messages[messages.length - 1]
  const activeClarification =
    lastMessage && !lastMessage.isUser && !isStreaming
      ? lastMessage.clarification
      : undefined

  const activeDynamicPicker =
    lastMessage && !lastMessage.isUser && !isStreaming
      ? lastMessage.dynamicPicker
      : undefined

  const handleNewChat = useCallback(() => {
    cancelStream()
    resetChat()
    setIsDrawerOpen(false)

    // Extract continuation prompt from the last assistant message (between <code> tags)
    const lastMessage = messages[messages.length - 1]
    const match = lastMessage?.text?.match(/<code[^>]*>([\s\S]*?)<\/code>/)
    const continuationPrompt = match ? match[1].trim() : ''

    const newState = {
      flowName: 'Build with AI',
      chatInput: continuationPrompt,
      chatMessages: [],
      output: { trigger: '', actions: '', name: 'Build with AI', traceId: '' },
    }

    // Synchronously update persisted state so the next render sees empty messages
    // immediately (avoids a stale intermediate render with old messages)
    setChatState(newState)

    navigate(`${URLS.EDITOR}/ai`, { state: newState, replace: true })
  }, [
    cancelStream,
    resetChat,
    setIsDrawerOpen,
    setChatState,
    navigate,
    messages,
  ])

  const handleOpenPreview = useCallback(() => {
    if (chatInput !== messages[messages.length - 1].text) {
      navigate(`${URLS.EDITOR}/ai`, {
        state: {
          ...location.state,
          chatInput: messages[messages.length - 1].text,
          chatMessages: messages,
        },
        replace: true,
      })
    }

    if (!isMobile) {
      setIsDrawerOpen(true)
    }
  }, [chatInput, messages, setIsDrawerOpen, navigate, location.state, isMobile])

  // Auto-open preview when streaming completes and result is ready
  useEffect(() => {
    if (hasMessages && !isStreaming && isReadyForPreview) {
      handleOpenPreview()
    }
  }, [isStreaming, hasMessages, isReadyForPreview, handleOpenPreview])

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
            onConnectForm={onConnectForm}
            attachedForm={attachedForm}
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
                  clarification={activeClarification}
                  dynamicPicker={activeDynamicPicker}
                  onAddConnection={onAddConnection}
                  knownFormUrl={knownFormUrl}
                  onConnectForm={onConnectForm}
                  attachedForm={attachedForm}
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
