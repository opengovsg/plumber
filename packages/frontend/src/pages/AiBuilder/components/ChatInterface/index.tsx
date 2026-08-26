import { useCallback, useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Box, Flex, Text } from '@chakra-ui/react'
import { StickToBottom } from 'use-stick-to-bottom'

import * as URLS from '@/config/urls'
import { Message } from '@/hooks/useChatStream'
import { useAiBuilderContext } from '@/pages/AiBuilder/AiBuilderContext'
import ChatMessages from '@/pages/AiBuilder/components/ChatMessages'
import { PLACEHOLDER_MESSAGES } from '@/pages/AiBuilder/constants'
import { createNewChatDraft } from '@/pages/AiBuilder/new-chat'

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
  onAddConnection?: (context: { question: string; appKey: string }) => void
  knownFormUrl?: string
  onConnectForm?: () => void
  /** Resets any form-connection state that lives outside useChatStream's own reset. */
  onNewChat?: () => void
  onSelectExistingForm?: (label: string, connectionId: string) => void
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
    onNewChat,
    onSelectExistingForm,
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

  const activeColumnTable =
    lastMessage && !lastMessage.isUser && !isStreaming
      ? lastMessage.columnTable
      : undefined

  const handleNewChat = useCallback(() => {
    cancelStream()
    resetChat()
    onNewChat?.()
    setIsDrawerOpen(false)

    // Build the new draft from the last assistant message's continuation prompt.
    // createNewChatDraft() always mints its own fresh chatId, so the new chat starts
    // its own Langfuse session and never carries the old id forward.
    const lastMessage = messages[messages.length - 1]
    const newState = createNewChatDraft(lastMessage?.text)

    // Synchronously update persisted state so the next render sees empty messages
    // immediately (avoids a stale intermediate render with old messages)
    setChatState(newState)

    navigate(`${URLS.EDITOR}/ai`, { state: newState, replace: true })
  }, [
    cancelStream,
    resetChat,
    onNewChat,
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
            onSelectExistingForm={onSelectExistingForm}
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
                  columnTable={activeColumnTable}
                  onAddConnection={onAddConnection}
                  knownFormUrl={knownFormUrl}
                  onConnectForm={onConnectForm}
                  onSelectExistingForm={onSelectExistingForm}
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
