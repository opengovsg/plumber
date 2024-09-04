import type {
  IAction,
  IBaseTrigger,
  IJSONObject,
  IStep,
  ISubstep,
  ITrigger,
  ITriggerInstructions,
} from '@plumber/types'

import { useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { useMutation } from '@apollo/client'
import { Box, Collapse } from '@chakra-ui/react'
import { Button } from '@opengovsg/design-system-react'

import ErrorResult from '@/components/ErrorResult'
import FlowSubstepTitle from '@/components/FlowSubstepTitle'
import WebhookUrlInfo from '@/components/WebhookUrlInfo'
import { EditorContext } from '@/contexts/Editor'
import { ExecutionStep } from '@/graphql/__generated__/graphql'
import { EXECUTE_STEP } from '@/graphql/mutations/execute-step'
import { GET_TEST_EXECUTION_STEPS } from '@/graphql/queries/get-test-execution-steps'
import {
  extractVariables,
  filterVariables,
  VISIBLE_VARIABLE_TYPES,
} from '@/helpers/variables'

import TestResult from './TestResult'

// the default alert follows the raw webhook alert
const defaultTriggerInstructions: ITriggerInstructions = {
  beforeUrlMsg: `# 1. You'll need to configure your application with this webhook URL.`,
  afterUrlMsg: `# 2. Send some data to the webhook URL after configuration. Then, click test step.`,
}

type TestSubstepProps = {
  substep: ISubstep
  expanded?: boolean
  onExpand: () => void
  onCollapse: () => void
  onChange?: ({ step }: { step: IStep }) => void
  onContinue?: () => void
  step: IStep
  selectedActionOrTrigger?: ITrigger | IAction
}

function TestSubstep(props: TestSubstepProps): JSX.Element {
  const {
    substep,
    expanded = false,
    onExpand,
    onCollapse,
    onContinue,
    step,
    selectedActionOrTrigger,
  } = props

  const { readOnly, testExecutionSteps } = useContext(EditorContext)
  const currentExecutionStep = testExecutionSteps.find(
    (executionStep) => executionStep.stepId === step.id,
  )

  /**
   * Temporary state to store the last execution step error details,
   * which could come from prior steps.
   * To remove after single step testing is implemented
   */
  const [lastErrorDetails, setLastErrorDetails] = useState<
    IJSONObject | undefined
  >()

  useEffect(() => {
    setLastErrorDetails(currentExecutionStep?.errorDetails)
  }, [currentExecutionStep])

  const [executeStep, { loading: isTestExecuting }] = useMutation(
    EXECUTE_STEP,
    {
      context: { autoSnackbar: false },
      awaitRefetchQueries: true,
      refetchQueries: [GET_TEST_EXECUTION_STEPS],
      update(cache, { data }) {
        // If last execution step is successful, it means the test run is successful
        // Update the step status to completed without refreshing
        const lastExecutionStep: ExecutionStep = data?.executeStep
        if (lastExecutionStep.status === 'success') {
          const stepCache = cache.identify({
            __typename: 'Step',
            id: step.id,
          })
          cache.modify({
            id: stepCache,
            fields: {
              status: () => 'completed',
            },
          })
        } else {
          setLastErrorDetails(lastExecutionStep.errorDetails ?? undefined)
        }
      },
    },
  )

  const testVariables = useMemo(() => {
    if (!currentExecutionStep) {
      return null
    }
    const stepWithVariables = filterVariables(
      extractVariables([currentExecutionStep]),
      (variable) => {
        const variableType = variable.type ?? 'text'
        return VISIBLE_VARIABLE_TYPES.includes(variableType)
      },
    )
    if (stepWithVariables.length > 0) {
      return stepWithVariables[0].output
    }
    return []
  }, [currentExecutionStep])

  const isTestSuccessful = currentExecutionStep?.status === 'success'

  const executeTestFlow = useCallback(async () => {
    try {
      await executeStep({
        variables: {
          input: {
            stepId: step.id,
          },
        },
      })
    } catch (e) {
      console.error(e)
    }
  }, [executeStep, step.id])

  const onContinueClick = useCallback(() => {
    if (onContinue) {
      onContinue()
    }
  }, [onContinue])

  const onToggle = expanded ? onCollapse : onExpand

  return (
    <>
      <FlowSubstepTitle
        expanded={expanded}
        onClick={onToggle}
        title={substep.name}
      />
      <Collapse in={expanded} unmountOnExit style={{ overflow: 'initial' }}>
        <Box p="1rem 1rem 1.5rem">
          {step.webhookUrl && (
            <WebhookUrlInfo
              webhookUrl={step.webhookUrl}
              webhookTriggerInstructions={
                (selectedActionOrTrigger as IBaseTrigger)
                  .webhookTriggerInstructions || defaultTriggerInstructions
              }
              sx={{ mb: 2 }}
            />
          )}
          {lastErrorDetails ? (
            <Box w="100%">
              <ErrorResult errorDetails={lastErrorDetails} isTestRun={true} />
            </Box>
          ) : (
            <TestResult
              step={step}
              selectedActionOrTrigger={selectedActionOrTrigger}
              variables={testVariables}
              isMock={currentExecutionStep?.metadata?.isMock}
            />
          )}

          <Button
            isFullWidth
            variant={isTestSuccessful ? 'clear' : 'solid'}
            onClick={executeTestFlow}
            mt={2}
            isLoading={isTestExecuting}
            isDisabled={readOnly}
            data-test="flow-substep-continue-button"
          >
            {isTestSuccessful ? 'Test again' : 'Test Step'}
          </Button>
          {isTestSuccessful && (
            <Button
              isFullWidth
              onClick={onContinueClick}
              mt={2}
              isLoading={isTestExecuting}
              isDisabled={readOnly}
              data-test="flow-substep-continue-button"
            >
              Continue
            </Button>
          )}
        </Box>
      </Collapse>
    </>
  )
}

export default TestSubstep
