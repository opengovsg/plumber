import type {
  IAction,
  IBaseTrigger,
  IStep,
  ISubstep,
  ITrigger,
  ITriggerInstructions,
} from '@plumber/types'

import { useCallback, useContext, useMemo } from 'react'
import { BiCheck } from 'react-icons/bi'
import { useMutation } from '@apollo/client'
import { Box, Text } from '@chakra-ui/react'
import LoadingButton from '@mui/lab/LoadingButton'
import Collapse from '@mui/material/Collapse'
import ListItem from '@mui/material/ListItem'
import { Infobox } from '@opengovsg/design-system-react'
import FlowSubstepTitle from 'components/FlowSubstepTitle'
import VariablesList from 'components/VariablesList'
import WebhookUrlInfo from 'components/WebhookUrlInfo'
import { EditorContext } from 'contexts/Editor'
import { EXECUTE_FLOW } from 'graphql/mutations/execute-flow'
import { extractVariables, filterVariables } from 'helpers/variables'

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
  onSubmit?: () => void
  onContinue?: () => void
  step: IStep
  selectedActionOrTrigger?: ITrigger | IAction
}

function serializeErrors(graphQLErrors: any) {
  return graphQLErrors?.map((error: Record<string, unknown>) => {
    try {
      return {
        ...error,
        message: (
          <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>
            {JSON.stringify(JSON.parse(error.message as string), null, 2)}
          </pre>
        ),
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
    onSubmit,
    onContinue,
    step,
    selectedActionOrTrigger,
  } = props

  const editorContext = useContext(EditorContext)

  const [executeFlow, { data, error, loading, called }] = useMutation(
    EXECUTE_FLOW,
    { context: { autoSnackbar: false } },
  )

  const {
    data: response,
    skippedIfPublished = false,
    step: executionStep,
  } = data?.executeFlow ?? {}

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
  const hasNoOutput = !response && isExecuted
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
  }, [onSubmit, onContinue, isExecuted, step.id])

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
            <Infobox
              variant="error"
              sx={{ mb: 2, fontWeight: 500, width: '100%' }}
            >
              {serializeErrors(error.graphQLErrors).map((error: any) => (
                <div>{error.message}</div>
              ))}
            </Infobox>
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

          {hasNoOutput && (
            <Infobox variant="warning" width="100%">
              <Box>
                <Text fontWeight="600">We couldn't find any test data</Text>
                <Text mt={0.5}>
                  {selectedActionOrTrigger &&
                  'webhookTriggerInstructions' in selectedActionOrTrigger &&
                  selectedActionOrTrigger.webhookTriggerInstructions?.errorMsg
                    ? selectedActionOrTrigger.webhookTriggerInstructions
                        .errorMsg
                    : ''}
                </Text>
              </Box>
            </Infobox>
          )}

          {skippedIfPublished && (
            <Infobox variant="warning" width="full">
              <Text>
                This step would actually have been skipped if this pipe was
                published! We are just displaying results to enable you to test.
                Please be careful - results here may not be indicative of actual
                pipe output!
              </Text>
            </Infobox>
          )}

          {stepsWithVariables.length === 1 && (
            <Box w="100%">
              <Infobox
                icon={<BiCheck color="#0F796F" />}
                style={{
                  color: '#2C2E34',
                  background: '#E2EEED',
                }}
              >
                Here is the test data we found. You can use these as variables
                in your action steps below.
              </Infobox>
              <Box maxH="25rem" overflowY="scroll" w="100%">
                <VariablesList variables={stepsWithVariables[0].output} />
              </Box>
            </Box>
          )}

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
