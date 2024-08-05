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

  const editorContext = useContext(EditorContext)

  const [executeFlow, { data, error, loading, called }] = useMutation(
    EXECUTE_FLOW,
    { context: { autoSnackbar: false } },
  )

  // executionStep contains executionSteps because it is a step
  const { data: response, step: executionStep } = data?.executeFlow ?? {}

  const stepsWithVariables = useMemo(() => {
    if (!executionStep) {
      return []
    }

    return filterVariables(extractVariables([executionStep]), (variable) => {
      const variableType = variable.type ?? 'text'
      return VISIBLE_VARIABLE_TYPES.includes(variableType)
    })
  }, [executionStep])

  const isExecuted = !error && called && !loading
  const isCompleted = isExecuted && response

  const { name } = substep

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
      <FlowSubstepTitle expanded={expanded} onClick={onToggle} title={name} />
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

          <TestResult
            step={step}
            selectedActionOrTrigger={selectedActionOrTrigger}
            stepsWithVariables={stepsWithVariables}
            isExecuted={isExecuted}
            isMock={executionStep?.executionSteps[0].metadata?.isMock}
          />

          <Button
            isFullWidth
            variant={isCompleted ? 'clear' : 'solid'}
            onClick={executeTestFlow}
            mt={2}
            isLoading={loading}
            isDisabled={editorContext.readOnly}
            data-test="flow-substep-continue-button"
          >
            {isCompleted ? 'Test again' : 'Test Step'}
          </Button>
          {isCompleted && (
            <Button
              isFullWidth
              onClick={onContinueClick}
              mt={2}
              isLoading={loading}
              isDisabled={editorContext.readOnly}
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
