import type { IJSONObject } from '@plumber/types'

import { useCallback, useEffect, useMemo, useRef } from 'react'
import { Helmet } from 'react-helmet'
import { useLocation, useNavigate } from 'react-router-dom'
import { CloseButton, Container, Flex, HStack, Text } from '@chakra-ui/react'

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
import StepConfigContext from './StepConfigContext'

function AiBuilderContent() {
  const navigate = useNavigate()
  const {
    flowName,
    chatMessages,
    parameterLabelsByStepId: persistedParameterLabelsByStepId,
    clearPersistedState,
    isMobile,
    isDrawerOpen,
    steps,
  } = useAiBuilderContext()

  const {
    messages,
    currentResponse,
    isStreaming,
    isReady: isReadyForPreview,
    sendMessage,
    cancelStream,
    resetChat,
    hasReachedLimit,
    stepParametersByStepId,
    parameterLabelsByStepId,
    completedStepIds,
    activeStepId,
  } = useChatStream({ initialMessages: chatMessages })

  // Merge labels persisted in the draft (survive refresh, committed once a
  // turn finishes) with labels from the current streaming turn (live wins —
  // it's the freshest within this session, ahead of the next draft commit).
  const mergedParameterLabelsByStepId = useMemo(() => {
    const merged = { ...persistedParameterLabelsByStepId }
    for (const [stepId, labels] of Object.entries(parameterLabelsByStepId)) {
      merged[stepId] = { ...merged[stepId], ...labels }
    }
    return merged
  }, [persistedParameterLabelsByStepId, parameterLabelsByStepId])

  // stepParametersByStepId from useChatStream is derived by re-scanning the
  // live aiMessages for data-stepUpdate parts, which resets on refresh. The
  // steps' own `parameters` field (already persisted via data-pipeState/
  // output) carries the same saved values across refresh, so fall back to it
  // per-step; live (this turn's freshest tool result) wins when present.
  const mergedStepParametersByStepId = useMemo(() => {
    const merged: Record<string, IJSONObject> = {}
    for (const step of steps) {
      if (step.id && step.parameters) {
        merged[step.id] = step.parameters
      }
    }
    for (const [stepId, parameters] of Object.entries(stepParametersByStepId)) {
      merged[stepId] = parameters
    }
    return merged
  }, [steps, stepParametersByStepId])

  // completedStepIds from useChatStream is derived by re-scanning the live
  // aiMessages, which resets on refresh. The steps' own `status` field
  // (already persisted via data-pipeState/output) carries this same fact
  // across refresh, so fold it in rather than relying on the live scan alone.
  const mergedCompletedStepIds = useMemo(() => {
    const merged = new Set(completedStepIds)
    for (const step of steps) {
      if (step.id && step.status === 'completed') {
        merged.add(step.id)
      }
    }
    return merged
  }, [steps, completedStepIds])

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
    <StepConfigContext.Provider
      value={{
        stepParametersByStepId: mergedStepParametersByStepId,
        parameterLabelsByStepId: mergedParameterLabelsByStepId,
        completedStepIds: mergedCompletedStepIds,
        activeStepId,
      }}
    >
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
    </StepConfigContext.Provider>
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
        parameterLabelsByStepId: {},
      },
    )

  // Sync location state updates (from useChatStream navigate calls) to persisted state
  useEffect(() => {
    if (locationState) {
      setPersistedState(locationState)
    }
  }, [locationState, setPersistedState])

  const { flowName, output, chatInput, chatMessages, parameterLabelsByStepId } =
    persistedState

  return (
    <AiBuilderContextProvider
      flowName={flowName}
      chatInput={chatInput}
      chatMessages={chatMessages}
      output={output}
      parameterLabelsByStepId={parameterLabelsByStepId}
      clearPersistedState={clearPersistedState}
      setChatState={setPersistedState}
    >
      <AiBuilderContent />
    </AiBuilderContextProvider>
  )
}
