import type { IApp, IExecutionStep, IFlow, IStep } from '@plumber/types'

import { createContext, ReactNode, useCallback, useMemo, useState } from 'react'
import { useMutation, useQuery } from '@apollo/client'
import { Center, useDisclosure } from '@chakra-ui/react'
import { useIsMobile } from '@opengovsg/design-system-react'

import PrimarySpinner from '@/components/PrimarySpinner'
import {
  genVariableInfoMap,
  VariableInfoMap,
} from '@/components/RichTextEditor/utils'
import { ExecutionStep } from '@/graphql/__generated__/graphql'
import client from '@/graphql/client'
import { CREATE_STEP } from '@/graphql/mutations/create-step'
import { EXECUTE_STEP } from '@/graphql/mutations/execute-step'
import { UPDATE_STEP } from '@/graphql/mutations/update-step'
import { GET_APPS } from '@/graphql/queries/get-apps'
import { GET_FLOW } from '@/graphql/queries/get-flow'
import { GET_TEST_EXECUTION_STEPS } from '@/graphql/queries/get-test-execution-steps'
import {
  TOOLBOX_ACTIONS,
  TOOLBOX_APP_KEY,
  useIfThenInitializer,
} from '@/helpers/toolbox'
import { extractVariables, StepWithVariables } from '@/helpers/variables'

interface IEditorContextValue {
  flow: IFlow
  flowId: string
  readOnly: boolean
  testExecutionSteps: IExecutionStep[]
  currentStepId: string | null
  currentStepIndex: number | null
  hasIfThen: boolean
  currentTestExecutionStep: IExecutionStep | null
  isDrawerOpen: boolean
  isMobile: boolean
  isEmptyPipe: boolean
  isTestExecuting: boolean
  shouldWarnOnLeave: boolean
  stepsWithVars: StepWithVariables[]
  varInfoMap: VariableInfoMap
  executeTestStep: (testRunMetadata?: Record<string, unknown>) => Promise<void>
  onDrawerOpen: () => void
  onDrawerClose: () => void
  setCurrentStepId: (stepId: string | null) => void
  setCurrentStepIndex: (stepIndex: number | null) => void
  setShouldWarnOnLeave: (shouldWarnOnLeave: boolean) => void
  onCreateStep: (
    previousStepId: string,
    appKey: string,
    eventKey: string,
    connectionId?: string,
  ) => Promise<IStep>
  onUpdateStep: (step: IStep) => Promise<IStep>
  allApps: IApp[]
  resetForm: () => void
  resetTimestamp: number
}

export const EditorContext = createContext<IEditorContextValue>({
  flow: {} as IFlow,
  flowId: '',
  currentStepId: null,
  currentStepIndex: null,
  hasIfThen: false,
  currentTestExecutionStep: null,
  isDrawerOpen: false,
  isMobile: false,
  isEmptyPipe: false,
  isTestExecuting: false,
  shouldWarnOnLeave: false,
  stepsWithVars: [],
  readOnly: false,
  testExecutionSteps: [],
  varInfoMap: new Map(),
  onCreateStep: () => Promise.resolve({} as IStep),
  onDrawerClose: () => null,
  onDrawerOpen: () => null,
  onUpdateStep: () => Promise.resolve({} as IStep),
  executeTestStep: () => Promise.resolve(),
  setCurrentStepId: () => null,
  setCurrentStepIndex: () => null,
  setShouldWarnOnLeave: () => null,
  allApps: [],
  resetForm: () => null,
  resetTimestamp: 0,
})

type EditorProviderProps = {
  children: ReactNode
  readOnly: boolean
  flow: IFlow
  shouldWarnOnLeave: boolean
  setShouldWarnOnLeave: (shouldWarnOnLeave: boolean) => void
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
        stepName: null,
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
  shouldWarnOnLeave,
  setShouldWarnOnLeave,
  children,
}: EditorProviderProps) => {
  const isMobile = useIsMobile()

  const flowId = flow.id
  const [currentStepId, setCurrentStepId] = useState<string | null>(null)
  const [currentStepIndex, setCurrentStepIndex] = useState<number | null>(0)
  const [resetTimestamp, setResetTimestamp] = useState<number>(Date.now())

  const { data: getAppsData, loading: isLoadingAllApps } = useQuery(GET_APPS)

  const steps = flow?.steps ?? []
  const isEmptyPipe =
    steps.length <= 2 && steps.every((s) => s.key === null && s.appKey === null)

  const hasIfThen = flow?.steps.some(
    (step: IStep) => step.key === TOOLBOX_ACTIONS.IfThen,
  )

  const allApps = getAppsData?.getApps ?? []

  const { data } = useQuery<{ getTestExecutionSteps: IExecutionStep[] }>(
    GET_TEST_EXECUTION_STEPS,
    {
      variables: {
        flowId,
      },
    },
  )

  const testExecutionSteps = useMemo(
    () => data?.getTestExecutionSteps ?? [],
    [data],
  )

  const [stepsWithVars, varInfoMap] = useMemo(() => {
    const stepsWithVars = extractVariables(testExecutionSteps)
    const info = genVariableInfoMap(stepsWithVars)
    return [stepsWithVars, info]
  }, [testExecutionSteps])

  const currentTestExecutionStep = useMemo(
    () =>
      testExecutionSteps.find(
        (executionStep) => executionStep.stepId === currentStepId,
      ) ?? null,
    [testExecutionSteps, currentStepId],
  )

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
        config: {
          // NOTE: check for undefined to allow empty string, which defaults to the action/trigger name
          ...(step.config?.stepName !== undefined && {
            stepName: step.config?.stepName,
          }),
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

  /**
   * Test execution step
   */
  const [executeStep, { loading: isTestExecuting }] = useMutation(
    EXECUTE_STEP,
    {
      context: { autoSnackbar: false },
      awaitRefetchQueries: true,
      refetchQueries: [GET_TEST_EXECUTION_STEPS, GET_FLOW],
      update(cache, { data }) {
        // If last execution step is successful, it means the test run is successful
        // Update the step status to completed without refreshing
        const lastExecutionStep: ExecutionStep = data?.executeStep
        if (lastExecutionStep.status === 'success') {
          const stepCache = cache.identify({
            __typename: 'Step',
            id: currentStepId,
          })
          cache.modify({
            id: stepCache,
            fields: {
              status: () => 'completed',
            },
          })
        }
      },
    },
  )

  const executeTestStep = useCallback(
    async (testRunMetadata?: Record<string, unknown>) => {
      try {
        await executeStep({
          variables: {
            input: {
              stepId: currentStepId,
              testRunMetadata,
            },
          },
        })
      } catch (e) {
        console.error(e)
      }
    },
    [executeStep, currentStepId],
  )

  // Force the Form to remount by changing its key when discarding changes
  const resetForm = useCallback(() => {
    setResetTimestamp(Date.now())
  }, [])

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
        isEmptyPipe,
        flow,
        flowId,
        currentTestExecutionStep,
        isTestExecuting,
        readOnly,
        shouldWarnOnLeave,
        stepsWithVars,
        testExecutionSteps,
        varInfoMap,
        executeTestStep,
        onCreateStep,
        onDrawerOpen,
        onDrawerClose,
        onUpdateStep,
        setCurrentStepId,
        setCurrentStepIndex,
        setShouldWarnOnLeave,
        resetForm,
        resetTimestamp,
      }}
    >
      {children}
    </EditorContext.Provider>
  )
}
