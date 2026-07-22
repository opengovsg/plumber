import type { IJSONObject } from '@plumber/types'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Helmet } from 'react-helmet'
import { useLocation, useNavigate } from 'react-router-dom'
import { CloseButton, Container, Flex, HStack, Text } from '@chakra-ui/react'

import * as URLS from '@/config/urls'
import { useChatStream } from '@/hooks/useChatStream'
import { useNavigationGuard } from '@/hooks/useNavigationGuard'
import { usePersistedState } from '@/hooks/usePersistedState'

import AddFormsgConnectionModal from './components/AddFormsgConnectionModal'
import ChatInterface from './components/ChatInterface'
import ExitAlert from './components/ExitAlert'
import {
  AiBuilderContextProvider,
  useAiBuilderContext,
} from './AiBuilderContext'
import {
  buildKickoffMessage,
  extractFormIdFromLabel,
  extractLastFormUrl,
  stripFormIdPrefix,
} from './helpers'
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
    output,
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

  // A connection can only be created once the pipe (Flow row) exists —
  // populated from the streamed data-pipeState tool result once create_pipe
  // has run.
  const flowId: string | undefined = output?.pipeId

  // In-chat "Add new form" modal (FormSG), reached two ways:
  // - 'picker': mid-chat from the connection picker — the answer goes back in
  //   the same Q/A format as a manual selection.
  // - 'kickoff': from the empty-state "Connect your form" chip — connecting
  //   starts the conversation with a kickoff message.
  // Either way the secret key stays browser → GraphQL only (never through
  // the chat route or the LLM), and either way creating a *new* connection
  // requires flowId (the pipe) to already exist — see the gating below.
  const [addFormContext, setAddFormContext] = useState<
    { kind: 'picker'; question: string } | { kind: 'kickoff' } | null
  >(null)

  // Display-only composer chip anchoring the connected form (S3).
  const [attachedForm, setAttachedForm] = useState<{ label: string } | null>(
    null,
  )

  const prefillFormUrl = useMemo(() => extractLastFormUrl(messages), [messages])

  const handleAddConnection = useCallback(
    (context: { question: string }) =>
      setAddFormContext({ kind: 'picker', ...context }),
    [],
  )

  const handleConnectForm = useCallback(
    () => setAddFormContext({ kind: 'kickoff' }),
    [],
  )

  // Kicks off the chat with a connected form. The connection/form ids ride in
  // the message's "(id: …)" parenthetical (stripped from display) so the LLM
  // can assign the connection and fetch the schema in later setup.
  const kickoffWithForm = useCallback(
    (connectionLabel: string, connectionId: string) => {
      const formTitle = stripFormIdPrefix(connectionLabel)
      const formId = extractFormIdFromLabel(connectionLabel)
      setAttachedForm({ label: formTitle })
      sendMessage(buildKickoffMessage(formTitle, connectionId, formId))
    },
    [sendMessage],
  )

  // Reusing an existing connection kicks off the chat exactly like a freshly
  // added one — no new connection row is created.
  const handleSelectExistingForm = kickoffWithForm

  const handleAddFormSuccess = useCallback(
    (connectionLabel: string, connectionId: string) => {
      if (addFormContext?.kind === 'picker') {
        sendMessage(
          `Q: ${addFormContext.question}\nA: ${connectionLabel} (id: ${connectionId})`,
        )
      } else if (addFormContext?.kind === 'kickoff') {
        kickoffWithForm(connectionLabel, connectionId)
      }
      setAddFormContext(null)
    },
    [addFormContext, sendMessage, kickoffWithForm],
  )

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
              onAddConnection={flowId ? handleAddConnection : undefined}
              onConnectForm={flowId ? handleConnectForm : undefined}
              onSelectExistingForm={handleSelectExistingForm}
              attachedForm={attachedForm}
            />
          </Container>
        </Flex>
        <AddFormsgConnectionModal
          isOpen={addFormContext !== null}
          flowId={flowId}
          prefillFormUrl={prefillFormUrl}
          onClose={() => setAddFormContext(null)}
          onSuccess={handleAddFormSuccess}
        />
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
