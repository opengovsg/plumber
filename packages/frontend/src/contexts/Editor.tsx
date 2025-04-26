import type { IApp, IExecutionStep, IFlow, IStep } from '@plumber/types'

import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useState,
} from 'react'
import { useMutation, useQuery } from '@apollo/client'
import { Center, useDisclosure } from '@chakra-ui/react'
import { useIsMobile } from '@opengovsg/design-system-react'

import PrimarySpinner from '@/components/PrimarySpinner'
import { SINGLE_STEP_TEST_KILL_SWITCH } from '@/config/flags'
import client from '@/graphql/client'
import { CREATE_STEP } from '@/graphql/mutations/create-step'
import { UPDATE_STEP } from '@/graphql/mutations/update-step'
import { GET_APPS } from '@/graphql/queries/get-apps'
import { GET_FLOW } from '@/graphql/queries/get-flow'
import { GET_TEST_EXECUTION_STEPS } from '@/graphql/queries/get-test-execution-steps'
import {
  TOOLBOX_ACTIONS,
  TOOLBOX_APP_KEY,
  useIfThenInitializer,
} from '@/helpers/toolbox'

import { LaunchDarklyContext } from './LaunchDarkly'

interface IEditorContextValue {
  flowId: string
  readOnly: boolean
  testExecutionSteps: IExecutionStep[]
  currentStepId: string | null
  currentStepIndex: number | null
  hasIfThen: boolean
  isDrawerOpen: boolean
  isMobile: boolean
  onDrawerOpen: () => void
  onDrawerClose: () => void
  setCurrentStepId: (stepId: string | null) => void
  setCurrentStepIndex: (stepIndex: number | null) => void
  onCreateStep: (
    previousStepId: string,
    appKey: string,
    eventKey: string,
    connectionId?: string,
  ) => Promise<IStep>
  onUpdateStep: (step: IStep) => Promise<IStep>
  allApps: IApp[]
}

export const EditorContext = createContext<IEditorContextValue>({
  flowId: '',
  currentStepId: null,
  currentStepIndex: null,
  hasIfThen: false,
  isDrawerOpen: false,
  isMobile: false,
  readOnly: false,
  testExecutionSteps: [],
  onCreateStep: () => Promise.resolve({} as IStep),
  onDrawerClose: () => null,
  onDrawerOpen: () => null,
  onUpdateStep: () => Promise.resolve({} as IStep),
  setCurrentStepId: () => null,
  setCurrentStepIndex: () => null,
  allApps: [],
})

type EditorProviderProps = {
  children: ReactNode
  readOnly: boolean
  flowId: string
  flow: IFlow
}

/**
 * Helper function to update the flow in the cache
 */
function updateHandlerFactory(flowId: string, previousStepId: string) {
  return function createStepUpdateHandler(cache: any, mutationResult: any) {
    const { data } = mutationResult
    const { createStep: createdStep } = data
    const { getFlow: flow } = cache.readQuery({
      query: GET_FLOW,
      variables: { id: flowId },
    })

    // getFlow requires certain attributes to be returned
    const completeCreatedStep = {
      ...createdStep,
      iconUrl: null,
      webhookUrl: null,
      config: {
        templateConfig: {
          appEventKey: null,
        },
      },
      createdAt: new Date().toISOString(),
    }

    const steps = flow.steps.reduce((steps: any[], currentStep: any) => {
      if (currentStep.id === previousStepId) {
        return [...steps, currentStep, completeCreatedStep]
      }

      return [...steps, currentStep]
    }, [])

    cache.writeQuery({
      query: GET_FLOW,
      variables: { id: flowId },
      data: { getFlow: { ...flow, steps } },
    })
  }
}

export const EditorProvider = ({
  readOnly,
  flow,
  flowId,
  children,
}: EditorProviderProps) => {
  // TODO: remove this kill switch once Single Step Testing is stable
  const { flags } = useContext(LaunchDarklyContext)
  const shouldUseSingleStepTest = !flags?.[SINGLE_STEP_TEST_KILL_SWITCH]

  const isMobile = useIsMobile()

  const [currentStepId, setCurrentStepId] = useState<string | null>(null)
  const [currentStepIndex, setCurrentStepIndex] = useState<number | null>(0)

  const { data: getAppsData, loading: isLoadingAllApps } = useQuery(GET_APPS)
  const hasIfThen = flow?.steps.some(
    (step: IStep) => step.key === TOOLBOX_ACTIONS.IfThen,
  )

  const allApps = getAppsData?.getApps ?? []

  const { data } = useQuery<{ getTestExecutionSteps: IExecutionStep[] }>(
    GET_TEST_EXECUTION_STEPS,
    {
      variables: {
        flowId,
        // ignore test execution id and fetch execution steps by ordering if SST not enabled
        ignoreTestExecutionId: !shouldUseSingleStepTest,
      },
    },
  )

  const testExecutionSteps = data?.getTestExecutionSteps ?? []

  /**
   * Right drawer state
   */
  const {
    isOpen: isDrawerOpen,
    onOpen: onDrawerOpen,
    onClose: onDrawerClose,
  } = useDisclosure()

  /**
   * CreateStep mutation
   */

  const [createStep] = useMutation(CREATE_STEP, { refetchQueries: [GET_FLOW] })

  const [initializeIfThen] = useIfThenInitializer()

  // Add a step to the flow with the given appKey and eventKey
  const onCreateStep = useCallback(
    async (
      previousStepId: string,
      appKey: string,
      eventKey: string,
      connectionId?: string,
    ) => {
      const mutationInput = {
        previousStep: {
          id: previousStepId,
        },
        flow: {
          id: flowId,
        },
        appKey,
        key: eventKey,
        connection: { id: connectionId },
      }

      const createdStep = await createStep({
        variables: { input: mutationInput },
        update: updateHandlerFactory(flowId, previousStepId),
      })

      const newStep = createdStep.data.createStep
      setCurrentStepId(newStep.id)

      // account for the if-then edge case
      if (appKey === TOOLBOX_APP_KEY && eventKey === TOOLBOX_ACTIONS.IfThen) {
        // Get the complete step data from the cache
        const { getFlow: updatedFlow } = client.readQuery({
          query: GET_FLOW,
          variables: { id: flowId },
        })

        const completeStep = updatedFlow.steps.find(
          (s: IStep) => s.id === newStep.id,
        )

        if (completeStep) {
          const completeStepWithFlow = {
            ...completeStep,
            flowId: flowId,
          }
          return (await initializeIfThen(
            completeStepWithFlow,
          )) as unknown as IStep
        }
      }

      return newStep as IStep
    },
    [createStep, flowId, initializeIfThen, setCurrentStepId],
  )

  /**
   * UpdateStep mutation
   */
  const [updateStep] = useMutation(UPDATE_STEP)
  const onUpdateStep = useCallback(
    async (step: IStep) => {
      const mutationInput: Record<string, unknown> = {
        id: step.id,
        key: step.key,
        parameters: step.parameters,
        connection: {
          id: step.connection?.id,
        },
        flow: {
          id: flowId,
        },
        ...(step.status !== undefined && { status: step.status }),
      }

      if (step.appKey) {
        mutationInput.appKey = step.appKey
      }

      const updatedStep = await updateStep({
        variables: { input: mutationInput },
      })

      return updatedStep.data?.updateStep as IStep
    },
    [updateStep, flowId],
  )

  if (isLoadingAllApps) {
    return (
      <Center height="100vh" position="fixed" width="full" top={0} left={0}>
        <PrimarySpinner fontSize="4xl" />
      </Center>
    )
  }

  return (
    <EditorContext.Provider
      value={{
        allApps,
        currentStepId,
        currentStepIndex,
        hasIfThen,
        isDrawerOpen,
        isMobile,
        onDrawerOpen,
        onDrawerClose,
        flowId,
        readOnly,
        testExecutionSteps,
        onCreateStep,
        onUpdateStep,
        setCurrentStepId,
        setCurrentStepIndex,
      }}
    >
      {children}
    </EditorContext.Provider>
  )
}
