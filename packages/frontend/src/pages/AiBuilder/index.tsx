import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Helmet } from 'react-helmet'
import { BiCopy } from 'react-icons/bi'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  CloseButton,
  Container,
  Divider,
  Flex,
  HStack,
  Text,
  Tooltip,
} from '@chakra-ui/react'
import { Badge } from '@opengovsg/design-system-react'
import copy from 'clipboard-copy'

import * as URLS from '@/config/urls'
import { useChatStream } from '@/hooks/useChatStream'
import { useNavigationGuard } from '@/hooks/useNavigationGuard'
import { usePersistedState } from '@/hooks/usePersistedState'

import ChatInterface from './components/ChatInterface'
import ExitAlert from './components/ExitAlert'
import {
  AiBuilderContextProvider,
  useAiBuilderContext,
} from './AiBuilderContext'

function AiBuilderContent() {
  const navigate = useNavigate()
  const {
    flowName,
    chatMessages,
    clearPersistedState,
    isMobile,
    isDrawerOpen,
    chatId,
  } = useAiBuilderContext()

  const [copied, setCopied] = useState(false)

  const handleCopyChatId = useCallback(async () => {
    await copy(chatId)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [chatId])

  const {
    messages,
    currentResponse,
    isStreaming,
    isReady: isReadyForPreview,
    sendMessage,
    cancelStream,
    resetChat,
    hasReachedLimit,
  } = useChatStream({ initialMessages: chatMessages })

  const cancelRef = useRef(null)

  // Determine if we have unsaved work
  // Show warning if there's ANY state worth protecting:
  // - Existing persisted chat messages
  // - New messages beyond persisted state
  // - Currently streaming a response
  const hasUnsavedWork = useMemo(
    () => chatMessages?.length > 0 || messages.length > 0 || isStreaming,
    [chatMessages?.length, messages.length, isStreaming],
  )

  // Guard navigation - clear persisted state when user confirms exit
  const { showWarning, guardedNavigate, confirm, cancel } = useNavigationGuard({
    when: hasUnsavedWork,
    onLeave: () => {
      cancelStream()
      clearPersistedState()
    },
    navigateBack: () => navigate(URLS.FLOWS, { replace: true }),
  })

  // Close button handler - uses guarded navigation
  const handleClose = useCallback(() => {
    guardedNavigate(() => navigate(URLS.FLOWS, { replace: true }))
  }, [guardedNavigate, navigate])

  return (
    <>
      <Helmet>
        <title>{flowName} | WIP</title>
      </Helmet>
      <Flex h="100vh" flexDirection="column">
        {!(isMobile && isDrawerOpen) && (
          <HStack
            position="fixed"
            top={0}
            left={0}
            right={0}
            zIndex={10}
            bg="white"
            justifyContent="space-between"
            alignItems="center"
            py={2}
            px={{ base: 4, md: 8 }}
            borderBottom="1px solid"
            borderColor="base.divider.medium"
          >
            <Flex flex={1} alignItems="center" minWidth={0} gap={2}>
              <CloseButton size="sm" onClick={handleClose} />

              <Text>{flowName}</Text>

              <Divider
                orientation="vertical"
                h={5}
                mx={2}
                borderColor="base.divider.strong"
              />

              <Text
                textStyle="caption-1"
                color="interaction.support.disabled-content"
                fontWeight="medium"
                letterSpacing="wider"
                textTransform="uppercase"
                whiteSpace="nowrap"
                flexShrink={0}
              >
                Chat ID
              </Text>

              <Badge
                bgColor="secondary.50"
                color="base.content.medium"
                fontFamily="mono"
                fontWeight="normal"
                flexShrink={0}
              >
                {chatId.length > 16 ? `${chatId.slice(0, 16)}…` : chatId}
              </Badge>

              <Tooltip label={copied ? 'Copied!' : 'Copy chat ID'} hasArrow>
                <Flex
                  as="button"
                  onClick={handleCopyChatId}
                  alignItems="center"
                  justifyContent="center"
                  color="base.content.medium"
                  _hover={{ color: 'base.content.default' }}
                  cursor="pointer"
                  aria-label="Copy chat ID"
                  flexShrink={0}
                >
                  <BiCopy size={16} />
                </Flex>
              </Tooltip>
            </Flex>
          </HStack>
        )}
        <Container
          maxW="full"
          px={0}
          py={0}
          mt={isMobile && isDrawerOpen ? 0 : '57px'}
          flex={1}
          overflowY="auto"
          bg="white"
        >
          <ChatInterface
            messages={messages}
            currentResponse={currentResponse}
            isStreaming={isStreaming}
            isReadyForPreview={isReadyForPreview}
            sendMessage={sendMessage}
            cancelStream={cancelStream}
            resetChat={resetChat}
            hasReachedLimit={hasReachedLimit}
          />
        </Container>
      </Flex>
      <ExitAlert
        cancelRef={cancelRef}
        isOpen={showWarning}
        onClose={cancel}
        onExit={confirm}
      />
    </>
  )
}

export default function AiBuilder() {
  const locationState = useLocation()?.state

  // Persist state to sessionStorage so it survives refresh
  const [persistedState, setPersistedState, clearPersistedState] =
    usePersistedState(
      'ai-builder-draft',
      locationState || {
        flowName: 'Build with AI',
        chatInput: '',
        chatMessages: [],
        output: {
          trigger: '',
          actions: '',
          name: 'Build with AI',
        },
      },
    )

  // Sync location state updates (from useChatStream navigate calls) to persisted state
  useEffect(() => {
    if (locationState) {
      setPersistedState((prev: typeof persistedState) => ({
        ...locationState,
        // Preserve the existing chatId when the navigation state doesn't carry one.
        // onFinish navigates after every message; without this the minted chatId would
        // be wiped and regenerated each message. "New Chat" sets a fresh chatId in
        // locationState, so it still correctly starts a new session.
        chatId: locationState.chatId ?? prev.chatId,
      }))
    }
  }, [locationState, setPersistedState])

  const { flowName, output, chatInput, chatMessages, chatId } = persistedState

  return (
    <AiBuilderContextProvider
      flowName={flowName}
      chatInput={chatInput}
      chatMessages={chatMessages}
      output={output}
      chatId={chatId}
      clearPersistedState={clearPersistedState}
      setChatState={setPersistedState}
    >
      <AiBuilderContent />
    </AiBuilderContextProvider>
  )
}
