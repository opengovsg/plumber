import type {
  IAction,
  IBaseTrigger,
  IStep,
  ISubstep,
  ITrigger,
  ITriggerAlert,
} from '@plumber/types'

import * as React from 'react'
import { useMutation } from '@apollo/client'
import LoadingButton from '@mui/lab/LoadingButton'
import Alert from '@mui/material/Alert'
import AlertTitle from '@mui/material/AlertTitle'
import Box from '@mui/material/Box'
import Collapse from '@mui/material/Collapse'
import ListItem from '@mui/material/ListItem'
import FlowSubstepTitle from 'components/FlowSubstepTitle'
import JSONViewer from 'components/JSONViewer'
import WebhookUrlInfo from 'components/WebhookUrlInfo'
import { EditorContext } from 'contexts/Editor'
import { EXECUTE_FLOW } from 'graphql/mutations/execute-flow'
import useFormatMessage from 'hooks/useFormatMessage'

// the default alert follows the raw webhook alert
const defaultTriggerAlert: ITriggerAlert = {
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
  selectedActionOrTrigger: ITrigger | IAction
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

function TestSubstep(props: TestSubstepProps): React.ReactElement {
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

  const formatMessage = useFormatMessage()
  const editorContext = React.useContext(EditorContext)

  const [executeFlow, { data, error, loading, called }] = useMutation(
    EXECUTE_FLOW,
    { context: { autoSnackbar: false } },
  )
  const response = data?.executeFlow?.data

  const isExecuted = !error && called && !loading
  const hasNoOutput = !response && isExecuted
  const isCompleted = isExecuted && response

  const { name } = substep

  const executeTestFlow = React.useCallback(() => {
    executeFlow({
      variables: {
        input: {
          stepId: step.id,
        },
      },
    })
  }, [onSubmit, onContinue, isExecuted, step.id])

  const onContinueClick = React.useCallback(() => {
    if (onContinue) {
      onContinue()
    }
  }, [onContinue])

  const onToggle = expanded ? onCollapse : onExpand

  return (
    <React.Fragment>
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
            <Alert
              severity="error"
              sx={{ mb: 2, fontWeight: 500, width: '100%' }}
            >
              {serializeErrors(error.graphQLErrors).map((error: any) => (
                <div>{error.message}</div>
              ))}
            </Alert>
          )}
          {step.webhookUrl && (
            <WebhookUrlInfo
              webhookUrl={step.webhookUrl}
              webhookTriggerAlert={
                (selectedActionOrTrigger as IBaseTrigger).webhookTriggerAlert ||
                defaultTriggerAlert
              }
              sx={{ mb: 2 }}
            />
          )}

          {hasNoOutput && (
            <Alert severity="warning" sx={{ mb: 1, width: '100%' }}>
              <AlertTitle sx={{ fontWeight: 700 }}>
                {formatMessage('flowEditor.noTestDataTitle')}
              </AlertTitle>

              <Box sx={{ fontWeight: 400 }}>
                {formatMessage('flowEditor.noTestDataMessage')}
              </Box>
            </Alert>
          )}

          {response && (
            <Box
              sx={{ maxHeight: 400, overflowY: 'auto', width: '100%' }}
              data-test="flow-test-substep-output"
            >
              <JSONViewer data={response} />
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
            {isCompleted
              ? formatMessage('flowEditor.testAgain')
              : formatMessage('flowEditor.testStep')}
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
              {formatMessage('flowEditor.continue')}
            </LoadingButton>
          )}
        </ListItem>
      </Collapse>
    </React.Fragment>
  )
}

export default TestSubstep
