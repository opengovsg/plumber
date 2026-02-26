import { IApp, IStep } from '@plumber/types'

import { createContext, useContext, useMemo } from 'react'
import { useQuery } from '@apollo/client'
import { Center } from '@chakra-ui/react'
import { datadogRum } from '@datadog/browser-rum'
import { useIsMobile } from '@opengovsg/design-system-react'

import PrimarySpinner from '@/components/PrimarySpinner'
import { LaunchDarklyContext } from '@/contexts/LaunchDarkly'
import { GET_APPS } from '@/graphql/queries/get-apps'
import { getStepGroupTypeAndCaption, getStepStructure } from '@/helpers/toolbox'

interface AIBuilderSharedProps {
  flowName: string
  formInput: {
    trigger: string
    actions: string
  }
  isFormMode: boolean
  output: {
    trigger: IStep
    actions: IStep[]
    traceId: string
  }
}

interface AiBuilderStep extends IStep {
  description?: string
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
  // TODO(kevinkim-ogp): remove this once A/B test is complete
  aiBuilderType: string
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
  flowName = 'Name your Pipe', // default to Name your Pipe if no flow name is provided
  formInput,
  isFormMode,
  output,
}: AiBuilderContextProviderProps) => {
  const isMobile = useIsMobile()
  const ddSessionId = datadogRum.getInternalContext()?.session_id ?? ''
  // TODO(kevinkim-ogp): remove this once A/B test is complete
  const { getFlagValue } = useContext(LaunchDarklyContext)
  const aiBuilderType = getFlagValue('ai-builder-type', 'none')

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
        formInput,
        isFormMode,
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
        // TODO(kevinkim-ogp): remove this once A/B test is complete
        aiBuilderType,
      }}
    >
      {children}
    </AiBuilderContext.Provider>
  )
}
