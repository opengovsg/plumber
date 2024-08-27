import type {
  IAction,
  IBaseTrigger,
  IStep,
  ISubstep,
  ITrigger,
  ITriggerInstructions,
} from '@plumber/types'

import { useCallback, useContext, useMemo } from 'react'
import { useMutation } from '@apollo/client'
import { Box, Collapse } from '@chakra-ui/react'
import { Button } from '@opengovsg/design-system-react'

import ErrorResult from '@/components/ErrorResult'
import FlowSubstepTitle from '@/components/FlowSubstepTitle'
import WebhookUrlInfo from '@/components/WebhookUrlInfo'
import { EditorContext } from '@/contexts/Editor'
import { EXECUTE_FLOW } from '@/graphql/mutations/execute-flow'
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

function serializeErrors(graphQLErrors: any) {
  return graphQLErrors?.map((error: Record<string, unknown>) => {
    try {
      return {
        ...error,
        errorDetails: JSON.parse(error.message as string),
      }
    } catch {
      return error
    }
  })
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

  const [executeFlow, { error, loading }] = useMutation(EXECUTE_FLOW, {
    context: { autoSnackbar: false },
  })

  const currentExecutionStep = testExecutionSteps.find(
    (executionStep) => executionStep.stepId === step.id,
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

  const executeTestFlow = useCallback(() => {
    executeFlow({
      variables: {
        input: {
          stepId: step.id,
        },
      },
    })
  }, [executeFlow, step.id])

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

          {!!error?.graphQLErrors?.length && (
            <Box w="100%">
              {serializeErrors(error.graphQLErrors).map(
                (error: any, index: number) => (
                  <ErrorResult
                    key={index}
                    errorDetails={error.errorDetails}
                    isTestRun={true}
                  />
                ),
              )}
            </Box>
          )}
          {isTestSuccessful && (
            <TestResult
              step={step}
              selectedActionOrTrigger={selectedActionOrTrigger}
              variables={testVariables}
              isMock={currentExecutionStep.metadata?.isMock}
            />
          )}

          <Button
            isFullWidth
            variant={isTestSuccessful ? 'clear' : 'solid'}
            onClick={executeTestFlow}
            mt={2}
            isLoading={loading}
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
              isLoading={loading}
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
