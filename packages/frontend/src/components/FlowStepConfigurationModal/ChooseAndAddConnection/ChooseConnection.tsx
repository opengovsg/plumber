import { type IApp, IStep, ITestConnectionOutput } from '@plumber/types'

import { useCallback, useContext } from 'react'
import { BiChevronLeft } from 'react-icons/bi'
import { useMutation, useQuery } from '@apollo/client'
import { Flex, ModalBody, ModalHeader } from '@chakra-ui/react'
import { Button, ModalCloseButton } from '@opengovsg/design-system-react'

import { ModalState } from '@/components/FlowStepConfigurationModal'
import { EditorContext } from '@/contexts/Editor'
import { REGISTER_CONNECTION } from '@/graphql/mutations/register-connection'
import { TEST_CONNECTION } from '@/graphql/queries/test-connection'

import { DEFAULT_CHOOSE_CONNECTION_LABEL } from '../constants'

import ChooseConnectionDropdown from './ChooseConnectionDropdown'
import ConnectionHeader from './ConnectionHeader'
import SetConnectionButton from './SetConnectionButton'
import { ConnectionDropdownOption } from '.'

interface ChooseConnectionProps {
  selectedApp: IApp
  selectedConnectionId: string
  updateModalState: (newState: Partial<ModalState>) => void
  appConnectionsLoading: boolean
  connectionOptions: ConnectionDropdownOption[]
  handleConnectionChange: (value: string, shouldRefetch: boolean) => void
  handleSubmit: () => void
  mockStep?: IStep
  step?: IStep
}

export default function ChooseConnection(
  props: ChooseConnectionProps,
): JSX.Element {
  const {
    selectedApp,
    selectedConnectionId,
    updateModalState,
    appConnectionsLoading,
    connectionOptions,
    handleConnectionChange,
    handleSubmit,
    mockStep,
    step,
  } = props
  const editorContext = useContext(EditorContext)
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
      stepId: supportsConnectionRegistration ? mockStep?.id : undefined,
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
            stepId: mockStep?.id,
          },
        },
      })
      await retestConnection()
    }
  }, [
    mockStep,
    selectedConnectionId,
    registerConnection,
    supportsConnectionRegistration,
    retestConnection,
  ])

  const onBack = () => {
    const triggersOrActions = selectedApp.triggers || selectedApp.actions || []
    if (triggersOrActions.length === 1) {
      updateModalState({
        currentScreen: 'choose-app',
        selectedApp: null,
        selectedEvent: null,
        selectedConnectionId: '',
      })
    } else {
      updateModalState({
        currentScreen: 'choose-event',
        selectedEvent: null,
      })
    }
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
              isDisabled={editorContext.readOnly || appConnectionsLoading}
              connectionOptions={connectionOptions}
              onChange={handleConnectionChange}
              value={selectedConnectionId}
              application={selectedApp}
              onAddNewConnection={() =>
                updateModalState({ currentScreen: 'add-connection' })
              }
            />
            <SetConnectionButton
              onNextStep={handleSubmit}
              onRegisterConnection={onRegisterConnection}
              readOnly={editorContext.readOnly}
              supportsConnectionRegistration={supportsConnectionRegistration}
              testResult={testConnectionData?.testConnection}
              testResultLoading={testResultLoading}
              registerConnectionLoading={registerConnectionLoading}
              isNewStep={!step}
            />
          </Flex>
        </Flex>
      </ModalBody>
    </>
  )
}
