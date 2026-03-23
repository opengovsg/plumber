import { IApp, IStep } from '@plumber/types'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
import { useQuery } from '@apollo/client'
import { Center } from '@chakra-ui/react'
import { datadogRum } from '@datadog/browser-rum'
import { useIsMobile } from '@opengovsg/design-system-react'

import PrimarySpinner from '@/components/PrimarySpinner'
import { GET_APPS } from '@/graphql/queries/get-apps'
import { getStepGroupTypeAndCaption, getStepStructure } from '@/helpers/toolbox'
import { Message } from '@/hooks/useChatStream'

const STORAGE_KEY = 'ai-builder-draft'
const STALENESS_THRESHOLD_MS = 30 * 60 * 1000 // 30 minutes

export interface AiBuilderOutput {
  trigger: IStep
  actions: IStep[]
  traceId: string
}

interface PersistedAiBuilderState {
  flowName: string
  chatInput: string
  chatMessages: Message[]
  output: AiBuilderOutput | null
}

const DEFAULT_STATE: PersistedAiBuilderState = {
  flowName: 'Build with AI',
  chatInput: '',
  chatMessages: [],
  output: null,
}

function readPersistedState(): PersistedAiBuilderState {
  try {
    const stored = sessionStorage.getItem(STORAGE_KEY)
    if (stored !== null) {
      const parsed = JSON.parse(stored) as {
        value: PersistedAiBuilderState
        timestamp: number
      }
      if (
        parsed.timestamp &&
        Date.now() - parsed.timestamp < STALENESS_THRESHOLD_MS
      ) {
        return parsed.value
      }
      sessionStorage.removeItem(STORAGE_KEY)
    }
  } catch {
    // Corrupted data or storage unavailable
  }
  return DEFAULT_STATE
}

interface AiBuilderStep extends IStep {
  description?: string
}

interface AIBuilderContextValue {
  flowName: string
  chatInput: string
  chatMessages: Message[]
  output: AiBuilderOutput | null
  allApps: IApp[]
  triggerStep: IStep | null
  steps: AiBuilderStep[]
  isMobile: boolean
  actionSteps: IStep[]
  stepsBeforeGroup: IStep[]
  groupedSteps: IStep[][]
  stepGroupType: string | null
  stepGroupCaption: string | null
  ddSessionId: string
  isDrawerOpen: boolean
  isToolCalling: boolean
  setIsToolCalling: (isToolCalling: boolean) => void
  setIsDrawerOpen: (open: boolean) => void
  setFlowName: (name: string) => void
  setChatInput: (input: string) => void
  setChatMessages: (msgs: Message[] | ((prev: Message[]) => Message[])) => void
  setOutput: (output: AiBuilderOutput | null) => void
  clearPersistedState: () => void
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

interface AiBuilderContextProviderProps {
  children: React.ReactNode
}

export const AiBuilderContextProvider = ({
  children,
}: AiBuilderContextProviderProps) => {
  const isMobile = useIsMobile()
  const ddSessionId = datadogRum.getInternalContext()?.session_id ?? ''

  // Owned state — hydrated from sessionStorage on mount (read once)
  const [initialState] = useState(readPersistedState)
  const [isToolCalling, setIsToolCalling] = useState(false)
  const [flowName, setFlowName] = useState<string>(initialState.flowName)
  const [chatInput, setChatInput] = useState<string>(initialState.chatInput)
  const [chatMessages, setChatMessages] = useState<Message[]>(
    initialState.chatMessages,
  )
  const [output, setOutput] = useState<AiBuilderOutput | null>(
    initialState.output,
  )

  // Persist state to sessionStorage whenever it changes
  useEffect(() => {
    try {
      const data = {
        value: { flowName, chatInput, chatMessages, output },
        timestamp: Date.now(),
      }
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(data))
    } catch {
      // Storage full or unavailable
    }
  }, [flowName, chatInput, chatMessages, output])

  const clearPersistedState = useCallback(() => {
    try {
      sessionStorage.removeItem(STORAGE_KEY)
    } catch {
      // ignore
    }
    setFlowName(DEFAULT_STATE.flowName)
    setChatInput(DEFAULT_STATE.chatInput)
    setChatMessages(DEFAULT_STATE.chatMessages)
    setOutput(DEFAULT_STATE.output)
  }, [])

  const [isDrawerOpen, setIsDrawerOpen] = useState(false)

  // Update drawer state when isMobile changes (handles async isMobile hook)
  useEffect(() => {
    const shouldOpen =
      !isMobile && Boolean(output?.trigger || output?.actions?.length)

    if (shouldOpen !== isDrawerOpen) {
      setIsDrawerOpen(shouldOpen)
    }

    // NOTE: re-trigger based on changes to isMobile
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMobile])

  const { data: getAppsData, loading: isLoadingAllApps } = useQuery(GET_APPS)

  const allApps = useMemo(
    () => getAppsData?.getApps ?? [],
    [getAppsData?.getApps],
  )
  const appsWithActions: IApp[] = allApps.filter(
    (app: IApp) => !!app.actions?.length,
  )

  /**
   * NOTE: process the steps that have been returned by Pair
   * as if its in the Editor, but a lot simpler
   */
  const steps = useMemo(
    () =>
      [
        ...(output?.trigger ? [output.trigger] : []),
        ...(output?.actions || []),
      ].map((step, index) => ({
        ...step,
        position: index + 1,
      })),
    [output?.trigger, output?.actions],
  )
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
        actionSteps: output?.actions || [],
        stepsBeforeGroup,
        groupedSteps,
        stepGroupType,
        stepGroupCaption,
        ddSessionId,
        clearPersistedState,
        isDrawerOpen,
        setIsDrawerOpen,
        setFlowName,
        setChatInput,
        setChatMessages,
        setOutput,
        setIsToolCalling,
        isToolCalling,
      }}
    >
      {children}
    </AiBuilderContext.Provider>
  )
}
