import type { ITestConnectionOutput } from '@plumber/types'

import { useCallback, useContext } from 'react'
import { BiChevronLeft } from 'react-icons/bi'
import { useMutation, useQuery } from '@apollo/client'
import { Flex, ModalBody, ModalHeader } from '@chakra-ui/react'
import { Button, ModalCloseButton } from '@opengovsg/design-system-react'

import { EditorContext } from '@/contexts/Editor'
import { REGISTER_CONNECTION } from '@/graphql/mutations/register-connection'
import { TEST_CONNECTION } from '@/graphql/queries/test-connection'

import { FlowStepConfigurationContext } from '../FlowStepConfigurationContext'
import InvalidModalScreen from '../InvalidModalScreen'

import ChooseConnectionDropdown from './ChooseConnectionDropdown'
import ConnectionHeader from './ConnectionHeader'
import { DEFAULT_CHOOSE_CONNECTION_LABEL } from './constants'
import SetConnectionButton from './SetConnectionButton'
import { ConnectionDropdownOption } from '.'

interface ChooseConnectionProps {
  appConnectionsLoading: boolean
  connectionOptions: ConnectionDropdownOption[]
  handleConnectionChange: (value: string, shouldRefetch: boolean) => void
  handleSubmit: () => void
}

export default function ChooseConnection(
  props: ChooseConnectionProps,
): JSX.Element {
  const {
    appConnectionsLoading,
    connectionOptions,
    handleConnectionChange,
    handleSubmit,
  } = props
  const { readOnly, flowId } = useContext(EditorContext)

  const { modalState, patchModalState, step } = useContext(
    FlowStepConfigurationContext,
  )
  const { selectedApp, selectedConnectionId } = modalState

  const supportsConnectionRegistration =
    !!selectedApp?.auth?.connectionRegistrationType

  const connectionModalLabel = selectedApp?.auth?.connectionModalLabel

  const {
    loading: testResultLoading,
    refetch: retestConnection,
    data: testConnectionData,
  } = useQuery<{
    testConnection: ITestConnectionOutput
  }>(TEST_CONNECTION, {
    variables: {
      connectionId: selectedConnectionId,
      flowId: supportsConnectionRegistration ? flowId : undefined,
    },
    skip: !selectedConnectionId,
  })

  const [registerConnection, { loading: registerConnectionLoading }] =
    useMutation(REGISTER_CONNECTION)

  const onRegisterConnection = useCallback(async () => {
    if (selectedConnectionId && supportsConnectionRegistration) {
      await registerConnection({
        variables: {
          input: {
            connectionId: selectedConnectionId,
            flowId,
          },
        },
      })
      await retestConnection()
    }
  }, [
    selectedConnectionId,
    supportsConnectionRegistration,
    registerConnection,
    flowId,
    retestConnection,
  ])

  const onBack = () => {
    if (!selectedApp) {
      return
    }

    const triggersOrActions = selectedApp.triggers || selectedApp.actions || []
    if (triggersOrActions.length === 1) {
      patchModalState({
        currentScreen: 'choose-app',
        selectedApp: null,
        selectedEvent: null,
        selectedConnectionId: '',
      })
    } else {
      patchModalState({
        currentScreen: 'choose-event',
        selectedEvent: null,
      })
    }
  }

  if (!selectedApp) {
    return <InvalidModalScreen />
  }

  return (
    <>
      {/* Hide back button only if step has both the key and appKey */}
      <ModalHeader>
        {(!step?.key || !step?.appKey) && (
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
        <ConnectionHeader
          selectedApp={selectedApp}
          headerText={
            connectionModalLabel?.chooseConnectionLabel ??
            DEFAULT_CHOOSE_CONNECTION_LABEL
          }
        />
      </ModalHeader>
      <ModalCloseButton mt={2} size="xs" />

      <ModalBody mb={4}>
        <Flex flexDir="column" alignItems="center" gap={6}>
          <Flex w="100%" flexDir="column" gap={4}>
            <ChooseConnectionDropdown
              isDisabled={readOnly || appConnectionsLoading}
              connectionOptions={connectionOptions}
              onChange={handleConnectionChange}
              value={selectedConnectionId}
              application={selectedApp}
              onAddNewConnection={() =>
                patchModalState({ currentScreen: 'add-connection' })
              }
            />
            <SetConnectionButton
              onNextStep={handleSubmit}
              onRegisterConnection={onRegisterConnection}
              readOnly={readOnly}
              supportsConnectionRegistration={supportsConnectionRegistration}
              testResult={testConnectionData?.testConnection}
              testResultLoading={testResultLoading}
              registerConnectionLoading={registerConnectionLoading}
              isNewStep={true}
            />
          </Flex>
        </Flex>
      </ModalBody>
    </>
  )
}
