import type {
  IApp,
  IExecutionStep,
  IFlow,
  IStep,
  IStepConfig,
} from '@plumber/types'

import {
  createContext,
  ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react'
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
import { GET_FLOW } from '@/graphql/queries/get-flow'
import { GET_TEST_EXECUTION_STEPS } from '@/graphql/queries/get-test-execution-steps'
import {
  isForEachStep,
  isIfThenStep,
  TOOLBOX_ACTIONS,
  TOOLBOX_APP_KEY,
  useIfThenInitializer,
} from '@/helpers/toolbox'
import { extractVariables, StepWithVariables } from '@/helpers/variables'
import { useApps } from '@/hooks/useApps'

interface IEditorContextValue {
  flow: IFlow
  flowId: string
  readOnly: boolean
  testExecutionSteps: IExecutionStep[]
  currentStepId: string | null
  hasEditPermission: boolean
  hasForEach: boolean
  hasIfThen: boolean
  currentTestExecutionStep: IExecutionStep | null
  isDrawerOpen: boolean
  isMobile: boolean
  isEmptyPipe: boolean
  isTestExecuting: boolean
  shouldWarnOnLeave: boolean
  stepsWithVars: StepWithVariables[]
  varInfoMap: VariableInfoMap
  executeTestStep: ({
    testRunMetadata,
    stepId,
  }: {
    testRunMetadata?: Record<string, unknown>
    stepId?: string | null
  }) => Promise<void>
  onDrawerOpen: () => void
  onDrawerClose: () => void
  setCurrentStepId: (stepId: string | null) => void
  setShouldWarnOnLeave: (shouldWarnOnLeave: boolean) => void
  onCreateStep: (
    previousStepId: string,
    appKey: string,
    eventKey: string,
    connectionId?: string,
    config?: IStepConfig,
  ) => Promise<IStep>
  onUpdateStep: (step: IStep, onCompleted?: () => void) => Promise<IStep>
  allApps: IApp[]
  resetForm: () => void
  resetTimestamp: number
  isLoading: boolean
  hasFlowTransfer: boolean
}

export const EditorContext = createContext<IEditorContextValue>({
  flow: {} as IFlow,
  flowId: '',
  currentStepId: null,
  hasEditPermission: false,
  hasForEach: false,
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
  setShouldWarnOnLeave: () => null,
  allApps: [],
  resetForm: () => null,
  resetTimestamp: 0,
  isLoading: true,
  hasFlowTransfer: false,
})

type EditorProviderProps = {
  children: ReactNode
  flow: IFlow
  shouldWarnOnLeave: boolean
  setShouldWarnOnLeave: (shouldWarnOnLeave: boolean) => void
  resetFormRef?: React.MutableRefObject<(() => void) | null>
}

export const EditorProvider = ({
  flow,
  shouldWarnOnLeave,
  setShouldWarnOnLeave,
  resetFormRef,
  children,
}: EditorProviderProps) => {
  const isMobile = useIsMobile()

  // flow transfer phase 1: add check to prevent user from publishing pipe after submitting request
  const requestedEmail = flow?.pendingTransfer?.newOwner.email ?? ''
  const hasFlowTransfer = requestedEmail !== ''
  const readOnly = hasFlowTransfer || flow?.active || flow?.role === 'viewer'

  const flowId = flow.id
  const [currentStepId, setCurrentStepId] = useState<string | null>(null)
  const [resetTimestamp, setResetTimestamp] = useState<number>(Date.now())

  // Use REST API for apps data (faster than GraphQL due to caching)
  const { data: allApps, loading: isLoadingAllApps } = useApps()

  const steps = flow?.steps ?? []
  const isEmptyPipe =
    steps.length <= 2 && steps.every((s) => s.key === null && s.appKey === null)

  const hasForEach = flow?.steps.some((step) => isForEachStep(step))
  const hasIfThen = flow?.steps.some((step: IStep) => isIfThenStep(step))

  const { data, loading: isLoadingTestExecutionSteps } = useQuery<{
    getTestExecutionSteps: IExecutionStep[]
  }>(GET_TEST_EXECUTION_STEPS, {
    variables: {
      flowId,
    },
  })

  const testExecutionSteps = useMemo(
    () => data?.getTestExecutionSteps ?? [],
    [data],
  )

  const [stepsWithVars, varInfoMap] = useMemo(() => {
    const stepsWithVars = extractVariables(
      testExecutionSteps,
      undefined,
      allApps,
    )
    const info = genVariableInfoMap(stepsWithVars)
    return [stepsWithVars, info]
  }, [testExecutionSteps, allApps])

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

  const [createStep, { loading: isCreatingStep }] = useMutation(CREATE_STEP, {
    refetchQueries: [GET_FLOW],
  })

  const [initializeIfThen, isInitializingIfThen] = useIfThenInitializer()

  // Add a step to the flow with the given appKey and eventKey
  const onCreateStep = useCallback(
    async (
      previousStepId: string,
      appKey: string,
      eventKey: string,
      connectionId?: string,
      config?: IStepConfig,
    ) => {
      const mutationInput = {
        previousStep: {
          id: previousStepId,
        },
        flow: {
          id: flowId,
          updatedAt: flow.updatedAt,
        },
        appKey,
        key: eventKey,
        connection: { id: connectionId },
        config,
      }

      const createdStep = await createStep({
        variables: { input: mutationInput },
      })

      let newStep = createdStep.data.createStep
      setCurrentStepId(newStep.id)

      // account for the for-each and if-then
      if (appKey === TOOLBOX_APP_KEY && eventKey === TOOLBOX_ACTIONS.IfThen) {
        newStep = await initializeIfThen(newStep)
      }
      // we refetch GET_FLOW after everything is completed
      await client.refetchQueries({ include: [GET_FLOW] })

      return newStep as IStep
    },
    [createStep, flow, flowId, initializeIfThen],
  )

  /**
   * UpdateStep mutation
   */
  const [updateStep, { loading: isUpdatingStep }] = useMutation(UPDATE_STEP)
  const onUpdateStep = useCallback(
    async (step: IStep, onCompleted?: () => void) => {
      const mutationInput: Record<string, unknown> = {
        id: step.id,
        key: step.key,
        parameters: step.parameters,
        connection: {
          id: step.connection?.id,
        },
        flow: {
          id: flowId,
          updatedAt: flow.updatedAt,
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
        onCompleted: () => onCompleted?.(),
      })

      return updatedStep.data?.updateStep as IStep
    },
    [flow, flowId, updateStep],
  )

  /**
   * Test execution step
   */
  const [executeStep, { loading: isTestExecuting }] = useMutation(
    EXECUTE_STEP,
    {
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
    async ({
      testRunMetadata,
      stepId = currentStepId,
    }: {
      testRunMetadata?: Record<string, unknown>
      stepId?: string | null
    }) => {
      if (!stepId) {
        throw new Error('Step ID is required')
      }
      try {
        await executeStep({
          variables: {
            input: {
              stepId,
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

  // Set the resetForm function in the ref so EditorLayout can access it
  useEffect(() => {
    if (resetFormRef) {
      resetFormRef.current = resetForm
    }
  }, [resetForm, resetFormRef])

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
        hasEditPermission: flow.role === 'owner' || flow.role === 'editor',
        hasForEach,
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
        setShouldWarnOnLeave,
        resetForm,
        resetTimestamp,
        isLoading:
          isLoadingAllApps ||
          isLoadingTestExecutionSteps ||
          isCreatingStep ||
          isUpdatingStep ||
          isInitializingIfThen,
        hasFlowTransfer,
      }}
    >
      {children}
    </EditorContext.Provider>
  )
}
