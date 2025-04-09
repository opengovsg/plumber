import type { IApp, ITestConnectionOutput } from '@plumber/types'

import { useCallback, useContext, useMemo, useState } from 'react'
import { BiChevronLeft, BiQuestionMark, BiRightArrowAlt } from 'react-icons/bi'
import { useMutation, useQuery } from '@apollo/client'
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
import { EditorContext } from '@/contexts/Editor'
import { REGISTER_CONNECTION } from '@/graphql/mutations/register-connection'
import { TEST_CONNECTION } from '@/graphql/queries/test-connection'
import useAuthentication from '@/hooks/useAuthentication'

import { FlowStepConfigurationContext } from '../FlowStepConfigurationContext'

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
  handleSubmit: () => void
}) {
  return (
    <Flex flexDir="column" gap={3} mb={4}>
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

      <Button isFullWidth onClick={handleSubmit}>
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
  onRegisterConnection: () => void
  isLoading: boolean
}) {
  return (
    <Flex flexDir="column" gap={3} mb={4}>
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
      >
        Connect
      </Button>
    </Flex>
  )
}

interface ConfigureExcelConnectionProps {
  onBack: () => void
  handleSubmit: () => void
}

/**
 * This component is used to configure the Excel connection for a workflow step.
 * It should only appear if the connection is not yet registered.
 * Once the connection is registered, the component will display a success screen.
 */
export default function ConfigureExcelConnection(
  props: ConfigureExcelConnectionProps,
) {
  const { onBack, handleSubmit } = props
  const { flowId } = useContext(EditorContext)
  const { modalState, step } = useContext(FlowStepConfigurationContext)
  const { selectedApp, selectedConnectionId } = modalState
  const connectionModalLabel = selectedApp?.auth?.connectionModalLabel

  const [isRegistered, setIsRegistered] = useState(false) // track connection registration
  const { currentUser } = useAuthentication()

  const { loading: testResultLoading, data: testConnectionData } = useQuery<{
    testConnection: ITestConnectionOutput
  }>(TEST_CONNECTION, {
    variables: {
      connectionId: selectedConnectionId,
      flowId,
    },
    skip: !selectedConnectionId || !isRegistered, // skip if not registered yet
  })

  const [registerConnection, { loading: registerConnectionLoading }] =
    useMutation(REGISTER_CONNECTION)

  const onRegisterConnection = useCallback(async () => {
    if (selectedConnectionId) {
      await registerConnection({
        variables: {
          input: {
            connectionId: selectedConnectionId,
            flowId,
          },
        },
      })
      setIsRegistered(true)
    }
  }, [flowId, selectedConnectionId, registerConnection])

  // Determine if the connection test was successful
  const isConnectionValid = useMemo(() => {
    if (testResultLoading || !testConnectionData?.testConnection) {
      return false
    }
    if (
      testConnectionData?.testConnection?.connectionVerified === false ||
      testConnectionData?.testConnection?.registrationVerified === false
    ) {
      return false
    }
    return true
  }, [testConnectionData?.testConnection, testResultLoading])

  return (
    <>
      <ModalHeader>
        {!isConnectionValid && (!step?.key || !step?.appKey) && (
          <Button
            variant="clear"
            colorScheme="secondary"
            size="xs"
            onClick={onBack}
            leftIcon={<BiChevronLeft />}
            ml={-4}
          >
            Back
          </Button>
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
      <ModalCloseButton mt={2} size="xs" />

      <ModalBody>
        {isConnectionValid ? (
          <SuccessfulConnectionContent
            userEmail={currentUser?.email ?? ''}
            handleSubmit={handleSubmit}
          />
        ) : (
          <ConfigurationConnectionContent
            userEmail={currentUser?.email ?? ''}
            onRegisterConnection={onRegisterConnection}
            isLoading={registerConnectionLoading}
          />
        )}
      </ModalBody>
    </>
  )
}
