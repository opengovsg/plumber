import { ITestConnectionOutput } from '@plumber/types'

import { useCallback, useMemo } from 'react'
import { Alert, AlertIcon } from '@chakra-ui/react'
import { Button } from '@opengovsg/design-system-react'

interface SetConnectionButtonProps {
  onNextStep: () => void
  onRegisterWebhook: () => void
  readOnly: boolean
  supportsWebhookRegistration: boolean
  testResult: ITestConnectionOutput | undefined
  testResultLoading: boolean
  registerWebhookLoading: boolean
}

const SetConnectionButton = ({
  onNextStep,
  readOnly,
  onRegisterWebhook,
  supportsWebhookRegistration,
  testResult,
  testResultLoading,
  registerWebhookLoading,
}: SetConnectionButtonProps) => {
  const onSubmit = useCallback(() => {
    if (
      supportsWebhookRegistration &&
      testResult &&
      !testResult.webhookVerified
    ) {
      onRegisterWebhook()
    } else {
      onNextStep()
    }
  }, [onNextStep, onRegisterWebhook, supportsWebhookRegistration, testResult])

  const buttonText = useMemo(() => {
    if (testResultLoading) {
      return 'Testing connection...'
    }

    if (!testResult) {
      return 'Continue'
    }

    if (registerWebhookLoading) {
      return 'Registering webhook...'
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
  }, [
    readOnly,
    testResultLoading,
    testResult,
    supportsWebhookRegistration,
    registerWebhookLoading,
  ])

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
          testResultLoading ||
          registerWebhookLoading ||
          !testResult?.connectionVerified ||
          readOnly
        }
      >
        {buttonText}
      </Button>
    </>
  )
}

export default SetConnectionButton
