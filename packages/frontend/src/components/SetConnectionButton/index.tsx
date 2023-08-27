import { ITestConnectionResult } from '@plumber/types'

import { useCallback, useMemo } from 'react'
import { Alert, AlertIcon } from '@chakra-ui/react'
import { Button } from '@opengovsg/design-system-react'

interface SetConnectionButtonProps {
  onNextStep: () => void
  readOnly: boolean
  supportsWebhookRegistration: boolean
  testResult: ITestConnectionResult | undefined
  testResultLoading: boolean
}

const SetConnectionButton = ({
  onNextStep,
  readOnly,
  supportsWebhookRegistration,
  testResult,
  testResultLoading,
}: SetConnectionButtonProps) => {
  const onSubmit = useCallback(() => {
    if (
      supportsWebhookRegistration &&
      testResult &&
      !testResult.webhookVerified
    ) {
      // do sth
    } else {
      onNextStep()
    }
  }, [])

  const buttonText = useMemo(() => {
    if (testResultLoading || !testResult) {
      return 'Testing connection...'
    }

    if (!testResult.connectionVerified) {
      return 'Connection not verified'
    }

    if (!supportsWebhookRegistration) {
      return readOnly ? 'Connection verified' : 'Continue'
    }

    if (!testResult.webhookVerified) {
      return readOnly ? 'Not connected' : 'Connect'
    }

    return 'Continue'
  }, [readOnly, testResultLoading, testResult, supportsWebhookRegistration])

  return (
    <>
      {supportsWebhookRegistration && testResult?.message && (
        <Alert
          status={testResult?.webhookVerified ? 'success' : 'warning'}
          borderRadius={4}
        >
          <AlertIcon />
          {testResult.message}
        </Alert>
      )}
      <Button
        isFullWidth
        onClick={onSubmit}
        isDisabled={
          testResultLoading || !testResult?.connectionVerified || readOnly
        }
      >
        {buttonText}
      </Button>
    </>
  )
}

export default SetConnectionButton
