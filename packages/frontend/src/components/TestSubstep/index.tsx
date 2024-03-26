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
import { Box } from '@chakra-ui/react'
import LoadingButton from '@mui/lab/LoadingButton'
import Collapse from '@mui/material/Collapse'
import ListItem from '@mui/material/ListItem'
import ErrorResult from 'components/ErrorResult'
import FlowSubstepTitle from 'components/FlowSubstepTitle'
import WebhookUrlInfo from 'components/WebhookUrlInfo'
import { EditorContext } from 'contexts/Editor'
import { EXECUTE_FLOW } from 'graphql/mutations/execute-flow'
import { MOCK_EXECUTE_FLOW } from 'graphql/mutations/mock-execute-flow'
import { extractVariables, filterVariables } from 'helpers/variables'

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

  const isMockable = selectedActionOrTrigger?.mockAvailable

  const editorContext = useContext(EditorContext)

  const [
    executeFlow,
    {
      data: testData,
      error: testError,
      loading: testLoading,
      called: testCalled,
    },
  ] = useMutation(EXECUTE_FLOW, { context: { autoSnackbar: false } })

  const [
    mockExecuteFlow,
    {
      data: mockData,
      error: mockError,
      loading: mockLoading,
      called: mockCalled,
    },
  ] = useMutation(MOCK_EXECUTE_FLOW, { context: { autoSnackbar: false } })

  const data = testData || mockData
  const error = testError || mockError
  const loading = testLoading || mockLoading
  const called = testCalled || mockCalled

  const { data: response, step: executionStep } =
    data?.executeFlow ?? data?.mockExecuteFlow ?? {}

  const stepsWithVariables = useMemo(() => {
    if (!executionStep) {
      return []
    }

    return filterVariables(
      extractVariables([executionStep]),
      (variable) => (variable.type ?? 'text') === 'text',
    )
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

  const executeMockFlow = useCallback(() => {
    mockExecuteFlow({
      variables: {
        input: {
          stepId: step.id,
        },
      },
    })
  }, [mockExecuteFlow, step.id])

  const onContinueClick = useCallback(() => {
    if (onContinue) {
      onContinue()
    }
  }, [onContinue])

  const onToggle = expanded ? onCollapse : onExpand

  return (
    <>
      <FlowSubstepTitle expanded={expanded} onClick={onToggle} title={name} />
      <Collapse in={expanded} timeout="auto" unmountOnExit>
        <ListItem
          sx={{
            pt: 2,
            pb: 3,
            flexDirection: 'column',
            alignItems: 'flex-start',
          }}
        >
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

          <TestResult
            step={step}
            selectedActionOrTrigger={selectedActionOrTrigger}
            stepsWithVariables={stepsWithVariables}
            isExecuted={isExecuted}
          />

          <LoadingButton
            fullWidth
            variant={isCompleted ? 'text' : 'contained'}
            onClick={executeTestFlow}
            sx={{ mt: 2 }}
            loading={loading}
            disabled={editorContext.readOnly}
            color="primary"
            data-test="flow-substep-continue-button"
          >
            {isCompleted ? 'Test again' : 'Test Step'}
          </LoadingButton>
          {!isCompleted && isMockable && (
            <LoadingButton
              fullWidth
              variant={isCompleted ? 'text' : 'contained'}
              onClick={executeMockFlow}
              sx={{ mt: 2 }}
              loading={loading}
              disabled={editorContext.readOnly}
              color="primary"
              data-test="flow-substep-continue-button"
            >
              Test With Mock Data
            </LoadingButton>
          )}
          {isCompleted && (
            <LoadingButton
              fullWidth
              variant={'contained'}
              onClick={onContinueClick}
              sx={{ mt: 2 }}
              loading={loading}
              disabled={editorContext.readOnly}
              color="primary"
              data-test="flow-substep-continue-button"
            >
              Continue
            </LoadingButton>
          )}
        </ListItem>
      </Collapse>
    </>
  )
}

export default TestSubstep
