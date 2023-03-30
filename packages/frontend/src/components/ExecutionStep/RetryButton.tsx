import { useState } from 'react'
import { FormattedMessage } from 'react-intl'
import { useMutation } from '@apollo/client'
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline'
import ReplayIcon from '@mui/icons-material/Replay'
import { Button, Stack, Typography } from '@mui/material'
import { RETRY_EXECUTION_STEP } from 'graphql/mutations/retry-execution-step'
import useFormatMessage from 'hooks/useFormatMessage'
import { useSnackbar } from 'notistack'

interface RetryButtonProps {
  executionStepId: string
  canRetry: boolean
}

const RetryButton = ({ executionStepId, canRetry }: RetryButtonProps) => {
  const [isRetrySuccessful, setIsRetrySuccessful] = useState<boolean | null>(
    null,
  )

  const { enqueueSnackbar } = useSnackbar()
  const formatMessage = useFormatMessage()

  const [retryExecutionStep] = useMutation(RETRY_EXECUTION_STEP, {
    variables: {
      input: {
        executionStepId,
      },
    },
    onCompleted: () => {
      enqueueSnackbar(formatMessage('executionStep.retrySuccessMessage'), {
        variant: 'success',
      })
      setIsRetrySuccessful(true)
    },
    onError: () => {
      setIsRetrySuccessful(false)
    },
  })

  if (!canRetry) {
    return null
  }

  if (isRetrySuccessful == null) {
    return (
      <Button
        variant="text"
        endIcon={<ReplayIcon />}
        onClick={() => retryExecutionStep()}
      >
        <FormattedMessage id="executionStep.retry" />
      </Button>
    )
  } else {
    return (
      <Stack alignItems="center" flexDirection="row" gap={1} px={2}>
        <ErrorOutlineIcon color={isRetrySuccessful ? 'success' : 'error'} />
        <Typography
          variant="body2"
          color={isRetrySuccessful ? 'success.main' : 'error.main'}
        >
          <FormattedMessage
            id={
              isRetrySuccessful
                ? 'executionStep.retryStarted'
                : 'executionStep.retryFailed'
            }
          />
        </Typography>
      </Stack>
    )
  }
}

export default RetryButton
