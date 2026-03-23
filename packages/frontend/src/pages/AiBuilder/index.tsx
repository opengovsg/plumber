import { useCallback, useMemo, useRef } from 'react'
import { Helmet } from 'react-helmet'
import { useNavigate } from 'react-router-dom'
import { CloseButton, Container, Flex, HStack, Text } from '@chakra-ui/react'

import * as URLS from '@/config/urls'
import { useChatStream } from '@/hooks/useChatStream'
import { useNavigationGuard } from '@/hooks/useNavigationGuard'

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
  } = useAiBuilderContext()

  const {
    messages,
    currentResponse,
    isStreaming,
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
    () => chatMessages.length > 0 || messages.length > 0 || isStreaming,
    [chatMessages.length, messages.length, isStreaming],
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
  return (
    <AiBuilderContextProvider>
      <AiBuilderContent />
    </AiBuilderContextProvider>
  )
}
