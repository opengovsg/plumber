import { IApp, IStep } from '@plumber/types'

import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { Center } from '@chakra-ui/react'
import { datadogRum } from '@datadog/browser-rum'
import { useIsMobile } from '@opengovsg/design-system-react'

import PrimarySpinner from '@/components/PrimarySpinner'
import { getStepGroupTypeAndCaption, getStepStructure } from '@/helpers/toolbox'
import { useApps } from '@/hooks/useApps'
import { Message, PipeStatePart } from '@/hooks/useChatStream'

export interface AIBuilderDraftState {
  flowName: string
  chatInput: string
  chatMessages: Message[]
  // output can be populated (IStep values) or the initial empty state (empty strings)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  output: Record<string, any>
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
  isDrawerOpen: boolean
  setIsDrawerOpen: (open: boolean) => void
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
        clearPersistedState,
        setChatState,
        isDrawerOpen,
        setIsDrawerOpen,
      }}
    >
      {children}
    </AiBuilderContext.Provider>
  )
}
