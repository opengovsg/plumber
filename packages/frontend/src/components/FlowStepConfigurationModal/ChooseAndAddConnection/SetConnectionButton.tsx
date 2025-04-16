import { useCallback, useContext, useEffect, useMemo } from 'react'
import { Alert, AlertIcon } from '@chakra-ui/react'
import { Button } from '@opengovsg/design-system-react'

import { FlowStepConfigurationContext } from '../FlowStepConfigurationContext'
import { useConnectionVerification } from '../hooks/useConnectionRegistration'

interface SetConnectionButtonProps {
  onNextStep: () => Promise<void>
  readOnly: boolean
  isNewStep: boolean
}

const SetConnectionButton = ({
  onNextStep,
  readOnly,
  isNewStep,
}: SetConnectionButtonProps) => {
  const { modalState } = useContext(FlowStepConfigurationContext)
  const { selectedApp, selectedConnectionId } = modalState
  const supportsConnectionRegistration =
    !!selectedApp?.auth?.connectionRegistrationType

  const {
    testResult,
    testResultLoading,
    registerConnectionLoading,
    testConnection,
    onRegisterConnection,
  } = useConnectionVerification({
    supportsConnectionRegistration,
  })

  // Load test result for initial connection if present
  useEffect(() => {
    async function testInitialConnection() {
      await testConnection(selectedConnectionId)
    }
    if (selectedConnectionId) {
      testInitialConnection()
    }
  }, [selectedConnectionId, testConnection])

  const onSubmit = useCallback(async () => {
    if (
      supportsConnectionRegistration &&
      testResult &&
      !testResult.registrationVerified
    ) {
      await onRegisterConnection(selectedConnectionId)
    } else {
      await onNextStep()
    }
  }, [
    onNextStep,
    onRegisterConnection,
    selectedConnectionId,
    supportsConnectionRegistration,
    testResult,
  ])

  const stepActionText = isNewStep ? 'Add step' : 'Save and continue'

  const buttonText = useMemo(() => {
    if (testResultLoading) {
      return 'Testing connection...'
    }

    if (!testResult) {
      return stepActionText
    }

    if (registerConnectionLoading) {
      return 'Registering connection...'
    }

    if (!testResult.connectionVerified) {
      return 'Connection not verified'
    }

    if (!supportsConnectionRegistration) {
      return readOnly ? 'Connection verified' : stepActionText
    }

    if (!testResult.registrationVerified) {
      return readOnly ? 'Not connected' : 'Connect'
    }

    return stepActionText
  }, [
    readOnly,
    testResultLoading,
    testResult,
    supportsConnectionRegistration,
    registerConnectionLoading,
    stepActionText,
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
