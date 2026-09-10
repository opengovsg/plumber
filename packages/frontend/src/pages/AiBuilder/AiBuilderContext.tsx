import { useQuery } from '@apollo/client'
import { Center } from '@chakra-ui/react'
import { datadogRum } from '@datadog/browser-rum'
import { useIsMobile } from '@opengovsg/design-system-react'
import { IApp, IExecutionStep, IStep } from '@plumber/types'
import { createContext, useContext, useEffect, useMemo, useState } from 'react'

import PrimarySpinner from '@/components/PrimarySpinner'
import { GET_TEST_EXECUTION_STEPS } from '@/graphql/queries/get-test-execution-steps'
import { getStepGroupTypeAndCaption, getStepStructure } from '@/helpers/toolbox'
import { extractVariables } from '@/helpers/variables'
import { useApps } from '@/hooks/useApps'
import { Message, PipeStatePart } from '@/hooks/useChatStream'

export interface AIBuilderDraftState {
  flowName: string
  chatInput: string
  chatMessages: Message[]
  // output can be populated (IStep values) or the initial empty state (empty strings)
  // oxlint-disable-next-line typescript/no-explicit-any
  output: Record<string, any>
  /**
   * Unique id for this chat session, used as the Langfuse session id. Optional on the
   * type because a draft persisted before this field existed may not have one; that
   * case is left as-is rather than backfilled (see createNewChatDraft in new-chat.ts
   * for where a fresh chatId is actually minted).
   */
  chatId?: string
  // Human-readable overrides for opaque parameter values (e.g. a resolved
  // Slack channel name), keyed by stepId then parameter key. Display-only —
  // never persisted server-side, so it's carried in the same draft blob as
  // the rest of the session to survive a refresh.
  parameterLabelsByStepId?: Record<string, Record<string, string>>
}

interface AIBuilderSharedProps extends AIBuilderDraftState {
  clearPersistedState: () => void
  setChatState: (state: AIBuilderDraftState) => void
}

interface AiBuilderStep extends IStep {
  description?: string
  connectionLabel?: string | null
}

interface AIBuilderContextValue extends AIBuilderSharedProps {
  allApps: IApp[]
  triggerStep: IStep | null
  steps: AiBuilderStep[]
  isMobile: boolean
  actionSteps: IStep[]
  stepsBeforeGroup: IStep[]
  groupedSteps: IStep[][]
  stepGroupType: string | null
  stepGroupCaption: string | null
  // DataDog RUM Session ID so we can associate the trace with the RUM
  ddSessionId: string
  // Unique id for this chat session, used as the Langfuse session id
  chatId: string
  isDrawerOpen: boolean
  setIsDrawerOpen: (open: boolean) => void
  // Real output-field labels (from dataOutMetadata) and their test-executed
  // values, keyed the same way as the {{step.<id>.<path>}} placeholders —
  // only populated for steps that have actually been test-executed. Labels
  // fall back to a naive transform elsewhere; values simply aren't shown.
  variableLabelsByPath: Map<string, string>
  variableValuesByPath: Map<string, string>
  refetchTestExecutionSteps: () => Promise<unknown>
}

const AiBuilderContext = createContext<AIBuilderContextValue | undefined>(
  undefined,
)

export const useAiBuilderContext = () => {
  const context = useContext(AiBuilderContext)
  if (!context) {
    throw new Error(
      'useAiBuilderContext must be used within a AiBuilderContextProvider',
    )
  }
  return context
}

interface AiBuilderContextProviderProps extends AIBuilderSharedProps {
  children: React.ReactNode
}

export const AiBuilderContextProvider = ({
  children,
  flowName = 'Build with AI', // default to Build with AI if no flow name is provided
  chatInput,
  chatMessages,
  output,
  chatId,
  parameterLabelsByStepId = {},
  clearPersistedState,
  setChatState,
}: AiBuilderContextProviderProps) => {
  const isMobile = useIsMobile()
  const ddSessionId = datadogRum.getInternalContext()?.session_id ?? ''

  const [isDrawerOpen, setIsDrawerOpen] = useState(false)

  // Update drawer state when isMobile or output changes (handles async isMobile hook)
  useEffect(() => {
    const hasSteps = output?.pipeId
      ? Array.isArray(output?.steps) && output.steps.length > 0
      : Boolean(output?.trigger || output?.actions?.length)
    const shouldOpen = !isMobile && hasSteps

    if (shouldOpen !== isDrawerOpen) {
      setIsDrawerOpen(shouldOpen)
    }

    // NOTE: re-trigger based on changes to isMobile
    // oxlint-disable-next-line react/exhaustive-deps
  }, [isMobile])

  const { data: allApps, loading: isLoadingAllApps } = useApps()
  const appsWithActions: IApp[] = allApps.filter(
    (app: IApp) => !!app.actions?.length,
  )

  /**
   * NOTE: process the steps that have been returned by Pair
   * as if its in the Editor, but a lot simpler
   */
  const steps = useMemo(() => {
    // Phase 2b+: DB-backed pipe state — steps already have correct positions
    if (output?.pipeId && Array.isArray(output?.steps)) {
      return (output as PipeStatePart['data'])
        .steps as unknown as AiBuilderStep[]
    }
    // Phase 2a (proposal) and legacy path
    return [
      ...(output?.trigger ? [output.trigger] : []),
      ...(output?.actions || []),
    ].map((step, index) => ({
      ...step,
      position: index + 1,
    }))
  }, [output])
  const [triggerStep, stepsBeforeGroup, groupedSteps] = useMemo(
    () => getStepStructure(appsWithActions, steps),
    [appsWithActions, steps],
  )

  const { stepGroupType, stepGroupCaption } = useMemo(
    () => getStepGroupTypeAndCaption(groupedSteps),
    [groupedSteps],
  )

  const { data: testExecutionStepsData, refetch: refetchTestExecutionSteps } =
    useQuery<{ getTestExecutionSteps: IExecutionStep[] }>(
      GET_TEST_EXECUTION_STEPS,
      {
        variables: { flowId: output?.pipeId },
        skip: !output?.pipeId,
      },
    )

  // Only override the naive parseParameterValue label when the app actually
  // defined a real one — extractVariables falls back to the raw lodash path
  // itself when a field has no metadata label, which is worse than the
  // naive transform, not better. Values have no such fallback: they're only
  // ever populated for steps that have actually been test-executed.
  const { variableLabelsByPath, variableValuesByPath } = useMemo(() => {
    const labels = new Map<string, string>()
    const values = new Map<string, string>()
    const stepsWithVars = extractVariables(
      testExecutionStepsData?.getTestExecutionSteps ?? [],
      undefined,
      allApps,
    )
    for (const step of stepsWithVars) {
      for (const variable of step.output) {
        const path = variable.name.slice(`step.${step.id}.`.length)
        if (variable.label && variable.label !== path) {
          labels.set(variable.name, variable.label)
        }
        const displayValue = variable.displayedValue ?? variable.value
        if (displayValue != null && displayValue !== '') {
          values.set(variable.name, String(displayValue))
        }
      }
    }
    return { variableLabelsByPath: labels, variableValuesByPath: values }
  }, [testExecutionStepsData, allApps])

  if (isLoadingAllApps) {
    return (
      <Center h="100vh">
        <PrimarySpinner fontSize="4xl" />
      </Center>
    )
  }

  return (
    <AiBuilderContext.Provider
      value={{
        allApps,
        flowName,
        chatInput,
        chatMessages,
        output,
        parameterLabelsByStepId,
        isMobile,
        steps,
        triggerStep,
        actionSteps: output?.pipeId
          ? (output?.steps || []).filter(
              (s: { type: string }) => s.type === 'action',
            )
          : output?.actions || [],
        stepsBeforeGroup,
        groupedSteps,
        stepGroupType,
        stepGroupCaption,
        ddSessionId,
        chatId: chatId ?? '',
        clearPersistedState,
        setChatState,
        isDrawerOpen,
        setIsDrawerOpen,
        variableLabelsByPath,
        variableValuesByPath,
        refetchTestExecutionSteps,
      }}
    >
      {children}
    </AiBuilderContext.Provider>
  )
}
