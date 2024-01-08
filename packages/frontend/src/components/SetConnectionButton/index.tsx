import { ITestConnectionOutput } from '@plumber/types'

import { useCallback, useMemo } from 'react'
import { Alert, AlertIcon } from '@chakra-ui/react'
import { Button } from '@opengovsg/design-system-react'

interface SetConnectionButtonProps {
  onNextStep: () => void
  onRegisterConnection: () => void
  readOnly: boolean
  supportsConnectionRegistration: boolean
  testResult: ITestConnectionOutput | undefined
  testResultLoading: boolean
  registerConnectionLoading: boolean
}

const SetConnectionButton = ({
  onNextStep,
  readOnly,
  onRegisterConnection,
  supportsConnectionRegistration,
  testResult,
  testResultLoading,
  registerConnectionLoading,
}: SetConnectionButtonProps) => {
  const onSubmit = useCallback(() => {
    if (
      supportsConnectionRegistration &&
      testResult &&
      !testResult.registrationVerified
    ) {
      onRegisterConnection()
    } else {
      onNextStep()
    }
  }, [
    onNextStep,
    onRegisterConnection,
    supportsConnectionRegistration,
    testResult,
  ])

  const buttonText = useMemo(() => {
    if (testResultLoading) {
      return 'Testing connection...'
    }

    if (!testResult) {
      return 'Continue'
    }

    if (registerConnectionLoading) {
      return 'Registering connection...'
    }

    if (!testResult.connectionVerified) {
      return 'Connection not verified'
    }

    if (!supportsConnectionRegistration) {
      return readOnly ? 'Connection verified' : 'Continue'
    }

    if (!testResult.registrationVerified) {
      return readOnly ? 'Not connected' : 'Connect'
    }

    return 'Continue'
  }, [
    readOnly,
    testResultLoading,
    testResult,
    supportsConnectionRegistration,
    registerConnectionLoading,
  ])

  return (
    <>
      {supportsConnectionRegistration && testResult?.message && (
        <Alert
          status={testResult?.registrationVerified ? 'success' : 'warning'}
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
          registerConnectionLoading ||
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
