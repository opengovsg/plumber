import type { IApp, IJSONObject } from '@plumber/types'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Helmet } from 'react-helmet'
import { useLocation, useNavigate } from 'react-router-dom'
import { CloseButton, Container, Flex, HStack, Text } from '@chakra-ui/react'

import AddAppConnection from '@/components/AddAppConnection'
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
  buildFormConnectedMessage,
  buildKickoffMessage,
  buildPickerAnswerMessage,
  buildUrlSharedKickoffMessage,
  buildUrlSharedMessage,
  extractConnectionResult,
  extractFormIdFromLabel,
  extractLastFormUrl,
  formatFormUrlLabel,
  stripFormIdPrefix,
} from './helpers'
import { createNewChatDraft } from './new-chat'
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
    allApps,
  } = useAiBuilderContext()

  const {
    messages,
    currentResponse,
    isWorking,
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
    hasPipe,
    knownFormSchema,
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

  // Connecting a form only makes sense before the pipe exists — once created,
  // connection changes go through the LLM's picker flow. hasPipe covers the
  // live turn; output.pipeId covers persisted state after a refresh.
  const pipeCreated = hasPipe || Boolean(output?.pipeId)

  const cancelRef = useRef(null)

  // A connection can only be created once the pipe (Flow row) exists —
  // populated from the streamed data-pipeState tool result once create_pipe
  // has run.
  const flowId: string | undefined = output?.pipeId

  // In-chat "Add new form" modal (FormSG), reached two ways:
  // - 'picker' (post-pipe, from the connection picker / forced key card):
  //   full modal (URL + secret key), URL locked when already known; the
  //   answer goes back in the same Q/A format as a manual selection. Creates
  //   a real connection, so it requires flowId (the pipe) to already exist.
  // - 'kickoff' (pre-pipe, from the "Connect your form" pill): url-only
  //   modal — no secret key, no connection created; the URL just enters the
  //   conversation so the LLM can fetch the public schema.
  // The secret key stays browser → GraphQL only (never through the chat
  // route or the LLM).
  const [addFormContext, setAddFormContext] = useState<
    { kind: 'picker'; question: string } | { kind: 'kickoff' } | null
  >(null)

  // In-chat "add connection" modal for every non-FormSG app in
  // AI_BUILDER_INLINE_CONNECT_APP_KEYS — a thin wrapper around
  // AddAppConnection's generic authenticationSteps engine. Kept separate
  // from addFormContext above since FormSG's flow has its own two-kind
  // (picker/kickoff) state machine that doesn't apply here.
  const [addConnectionContext, setAddConnectionContext] = useState<{
    appKey: string
    question: string
  } | null>(null)

  // Display-only composer chip anchoring the connected form (S3).
  const [attachedForm, setAttachedForm] = useState<{ label: string } | null>(
    null,
  )

  const prefillFormUrl = useMemo(() => extractLastFormUrl(messages), [messages])

  // The composer chip anchors whatever form the conversation is about: the
  // connected form's title once a connection exists; otherwise the shared
  // form's real title (from the LLM's streamed get_form_schema result) with
  // a "not connected" cue, falling back to the compact URL until the schema
  // has been fetched.
  const displayedForm = useMemo(() => {
    if (attachedForm) {
      return { ...attachedForm, isConnected: true }
    }
    if (prefillFormUrl) {
      const urlFormId = extractFormIdFromLabel(prefillFormUrl)
      const title =
        knownFormSchema && knownFormSchema.formId === urlFormId
          ? knownFormSchema.title
          : null
      return {
        label: title ?? formatFormUrlLabel(prefillFormUrl),
        isConnected: false,
      }
    }
    return null
  }, [attachedForm, prefillFormUrl, knownFormSchema])

  const handleAddConnection = useCallback(
    (context: { question: string; appKey: string }) => {
      if (context.appKey === 'formsg') {
        setAddFormContext({ kind: 'picker', question: context.question })
        return
      }
      setAddConnectionContext(context)
    },
    [],
  )

  const handleConnectForm = useCallback(
    () => setAddFormContext({ kind: 'kickoff' }),
    [],
  )

  // Announces a connected form to the chat. The connection/form ids ride in
  // the message's "(id: …)" parenthetical (stripped from display) so the LLM
  // can assign the connection and fetch the schema in later setup. As the
  // first message it kicks off the conversation with a request for workflow
  // suggestions; mid-conversation it is a plain announcement so the LLM
  // continues from wherever the conversation is.
  const kickoffWithForm = useCallback(
    (connectionLabel: string, connectionId: string) => {
      const formTitle = stripFormIdPrefix(connectionLabel)
      const formId = extractFormIdFromLabel(connectionLabel)
      setAttachedForm({ label: formTitle })
      sendMessage(
        messages.length === 0
          ? buildKickoffMessage(formTitle, connectionId, formId)
          : buildFormConnectedMessage(formTitle, connectionId, formId),
      )
    },
    [sendMessage, messages.length],
  )

  // Reusing an existing connection kicks off the chat exactly like a freshly
  // added one — no new connection row is created.
  const handleSelectExistingForm = kickoffWithForm

  // Full-variant (URL + key) success — only reachable from the 'picker' kind.
  const handleAddFormSuccess = useCallback(
    (connectionLabel: string, connectionId: string) => {
      if (addFormContext?.kind === 'picker') {
        setAttachedForm({ label: stripFormIdPrefix(connectionLabel) })
        sendMessage(
          `Q: ${addFormContext.question}\nA: ${connectionLabel} (id: ${connectionId})`,
        )
      }
      setAddFormContext(null)
    },
    [addFormContext, sendMessage],
  )

  // AddAppConnection's onClose hands back the raw accumulated response from
  // walking auth.authenticationSteps, not a clean (label, id) pair — pull
  // out what the chat answer needs. If the step sequence never reached
  // createConnection (e.g. the user closed the modal, or a step failed and
  // the user hasn't retried), there's nothing to tell the chat.
  const handleGenericAddConnectionSuccess = useCallback(
    (response: Record<string, unknown>, fallbackLabel: string) => {
      if (!addConnectionContext) {
        return
      }
      const result = extractConnectionResult(response, fallbackLabel)
      if (result) {
        sendMessage(
          buildPickerAnswerMessage(
            addConnectionContext.question,
            result.label,
            result.connectionId,
          ),
        )
      }
      setAddConnectionContext(null)
    },
    [addConnectionContext, sendMessage],
  )

  // Url-only-variant submit — the user shared their form without a key. As
  // the first message it asks for suggestions; mid-conversation it is a
  // plain share the LLM picks up from where it is.
  const handleSubmitUrl = useCallback(
    (formUrl: string) => {
      sendMessage(
        messages.length === 0
          ? buildUrlSharedKickoffMessage(formUrl)
          : buildUrlSharedMessage(formUrl),
      )
      setAddFormContext(null)
    },
    [sendMessage, messages.length],
  )

  // "New Chat" resets the conversation/pipe, but attachedForm/addFormContext
  // live outside useChatStream's own reset — without this, the composer
  // chip would keep showing the previous conversation's connected form.
  const handleNewChat = useCallback(() => {
    setAttachedForm(null)
    setAddFormContext(null)
    setAddConnectionContext(null)
  }, [])

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

  const addConnectionApp: IApp | undefined = addConnectionContext
    ? allApps.find((app) => app.key === addConnectionContext.appKey)
    : undefined

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
              isWorking={isWorking}
              isStreaming={isStreaming}
              isReadyForPreview={isReadyForPreview}
              sendMessage={sendMessage}
              cancelStream={cancelStream}
              resetChat={resetChat}
              hasReachedLimit={hasReachedLimit}
              onAddConnection={flowId ? handleAddConnection : undefined}
              knownFormUrl={prefillFormUrl}
              onConnectForm={pipeCreated ? undefined : handleConnectForm}
              onNewChat={handleNewChat}
              onSelectExistingForm={
                pipeCreated ? undefined : handleSelectExistingForm
              }
              attachedForm={displayedForm}
            />
          </Container>
        </Flex>
        <AddFormsgConnectionModal
          isOpen={addFormContext !== null}
          flowId={flowId}
          variant={addFormContext?.kind === 'kickoff' ? 'url-only' : 'full'}
          prefillFormUrl={prefillFormUrl}
          lockFormUrl={
            addFormContext?.kind === 'picker' && Boolean(prefillFormUrl)
          }
          onClose={() => setAddFormContext(null)}
          onSuccess={handleAddFormSuccess}
          onSubmitUrl={handleSubmitUrl}
        />
        {addConnectionContext && addConnectionApp && flowId && (
          <AddAppConnection
            application={addConnectionApp}
            flowId={flowId}
            onClose={(response) =>
              handleGenericAddConnectionSuccess(response, addConnectionApp.name)
            }
          />
        )}
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

  // Persist state to sessionStorage so it survives refresh.
  //
  // locationState-carried drafts already have a chatId from wherever they were created ("New Chat", or a
  // prior render of this same draft);
  // createNewChatDraft() (no argument, so no continuation prompt) mints one for a genuinely fresh session.
  //
  // NOTE: any new navigate() call that passes `state` into this page needs a chatId
  const [persistedState, setPersistedState, clearPersistedState] =
    usePersistedState(
      'ai-builder-draft',
      () => locationState || createNewChatDraft(),
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

  const {
    flowName,
    output,
    chatInput,
    chatMessages,
    chatId,
    parameterLabelsByStepId,
  } = persistedState

  return (
    <AiBuilderContextProvider
      flowName={flowName}
      chatInput={chatInput}
      chatMessages={chatMessages}
      output={output}
      chatId={chatId}
      parameterLabelsByStepId={parameterLabelsByStepId}
      clearPersistedState={clearPersistedState}
      setChatState={setPersistedState}
    >
      <AiBuilderContent />
    </AiBuilderContextProvider>
  )
}
