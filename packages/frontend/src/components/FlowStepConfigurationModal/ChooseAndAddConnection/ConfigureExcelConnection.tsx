import type { IApp } from '@plumber/types'

import { useContext, useMemo } from 'react'
import { BiQuestionMark, BiRightArrowAlt } from 'react-icons/bi'
import {
  Flex,
  Icon,
  Image,
  ModalBody,
  ModalHeader,
  Text,
} from '@chakra-ui/react'
import { Button, ModalCloseButton } from '@opengovsg/design-system-react'

import microsoftFolder from '@/assets/microsoft-folder.svg'
import useAuthentication from '@/hooks/useAuthentication'

import BackButton from '../BackButton'
import { FlowStepConfigurationContext } from '../FlowStepConfigurationContext'
import { useConnectionVerification } from '../hooks/useConnectionRegistration'

import ConnectionHeader from './ConnectionHeader'

function ImageBox({
  imageUrl,
  boxSize,
}: {
  imageUrl: string
  boxSize: number
}) {
  return (
    <Image
      src={imageUrl}
      boxSize={boxSize}
      borderStyle="solid"
      fit="contain"
      fallback={
        <Icon
          boxSize={boxSize}
          as={BiQuestionMark}
          color="base.content.default"
        />
      }
    />
  )
}

function SuccessfulConnectionHeader({ iconUrl }: { iconUrl: string }) {
  return (
    <Flex flexDir="column" alignItems="center" gap={4}>
      <Flex justifyContent="center" alignItems="center" gap={4} mt={2}>
        <ImageBox imageUrl={iconUrl} boxSize={14} />
        <Icon as={BiRightArrowAlt} boxSize={6} color="base.content.default" />
        <ImageBox imageUrl={microsoftFolder} boxSize={28} />
      </Flex>
      <Text textStyle="h4">Almost there! To start using your Excel files:</Text>
    </Flex>
  )
}

function SuccessfulConnectionContent({
  userEmail,
  handleSubmit,
}: {
  userEmail: string
  handleSubmit: () => Promise<void>
}) {
  return (
    <Flex flexDir="column" gap={3}>
      <Text fontSize="sm" ml={4}>
        {`1. Find the `}
        <Text as="span" textDecoration="underline">
          {userEmail}
        </Text>
        {` folder we just created under 'Shared'`}
      </Text>
      <Text fontSize="sm" ml={4}>
        {`2. Place your Excel files in this folder to start using them`}
      </Text>

      <Button isFullWidth onClick={handleSubmit} mt={4}>
        Ok, got it!
      </Button>
    </Flex>
  )
}

function ConfigurationConnectionContent({
  userEmail,
  onRegisterConnection,
  isLoading,
}: {
  userEmail: string
  onRegisterConnection: () => Promise<void>
  isLoading: boolean
}) {
  return (
    <Flex flexDir="column" gap={3}>
      <Text>How it works:</Text>
      <Text fontSize="sm" ml={4}>
        {`1. We'll create a folder named `}
        <Text as="span" textDecoration="underline">
          {userEmail}
        </Text>
      </Text>
      <Text fontSize="sm" ml={4}>
        {`2. You can use any Excel file in this folder in your workflow`}
      </Text>

      <Button
        isFullWidth
        size="lg"
        onClick={onRegisterConnection}
        isLoading={isLoading}
        mt={4}
      >
        Connect
      </Button>
    </Flex>
  )
}

interface ConfigureExcelConnectionProps {
  onBack: () => void
  onCreateOrUpdateStep: (connectionId: string) => Promise<void>
}

/**
 * This component is used to configure the Excel connection for a workflow step.
 * It should only appear if the connection is not yet registered.
 * Once the connection is registered, the component will display a success screen.
 */
export default function ConfigureExcelConnection(
  props: ConfigureExcelConnectionProps,
) {
  const { onBack, onCreateOrUpdateStep } = props
  const { modalState, step } = useContext(FlowStepConfigurationContext)
  const { selectedApp, selectedConnectionId } = modalState
  const connectionModalLabel = selectedApp?.auth?.connectionModalLabel
  const { currentUser } = useAuthentication()

  const {
    testResult,
    testResultLoading,
    registerConnectionLoading,
    onRegisterConnection,
  } = useConnectionVerification({
    supportsConnectionRegistration: true, // Excel always supports connection registration
  })

  // Determine if the connection test was successful
  const isConnectionValid = useMemo(() => {
    if (testResultLoading || !testResult) {
      return false
    }
    if (
      testResult?.connectionVerified === false ||
      testResult?.registrationVerified === false
    ) {
      return false
    }
    return true
  }, [testResult, testResultLoading])

  return (
    <>
      <ModalHeader pt={0}>
        {!isConnectionValid && (!step?.key || !step?.appKey) && (
          <BackButton onBack={onBack} />
        )}
        {isConnectionValid ? (
          <SuccessfulConnectionHeader iconUrl={selectedApp?.iconUrl ?? ''} />
        ) : (
          <ConnectionHeader
            selectedApp={selectedApp as IApp}
            headerText={
              connectionModalLabel?.chooseConnectionLabel ??
              'Connect to M365 Excel'
            }
          />
        )}
      </ModalHeader>
      <ModalCloseButton mt={2} size="xs" colorScheme="secondary" />

      <ModalBody>
        {isConnectionValid ? (
          <SuccessfulConnectionContent
            userEmail={currentUser?.email ?? ''}
            handleSubmit={async () =>
              await onCreateOrUpdateStep(selectedConnectionId)
            }
          />
        ) : (
          <ConfigurationConnectionContent
            userEmail={currentUser?.email ?? ''}
            onRegisterConnection={async () =>
              await onRegisterConnection(selectedConnectionId)
            }
            isLoading={registerConnectionLoading}
          />
        )}
      </ModalBody>
    </>
  )
}
