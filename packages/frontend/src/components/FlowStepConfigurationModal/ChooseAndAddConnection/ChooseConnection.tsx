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

import SetConnectionButton from '../../SetConnectionButton'

import ChooseConnectionDropdown from './ChooseConnectionDropdown'
import ConnectionHeader from './ConnectionHeader'
import { ConnectionDropdownOption } from '.'

const DEFAULT_CHOOSE_CONNECTION_LABEL = 'Choose connection'

interface ChooseConnectionProps {
  onClose: () => void
  selectedApp: IApp
  updateModalState: (newState: Partial<ModalState>) => void
  selectedStep: IStep | null
  selectedConnectionId: string
  appConnectionsLoading: boolean
  connectionOptions: ConnectionDropdownOption[]
  handleConnectionChange: (value: string, shouldRefetch: boolean) => void
}

export default function ChooseConnection(
  props: ChooseConnectionProps,
): JSX.Element {
  const {
    onClose,
    selectedApp,
    updateModalState,
    selectedStep,
    selectedConnectionId,
    appConnectionsLoading,
    connectionOptions,
    handleConnectionChange,
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
      stepId: supportsConnectionRegistration ? selectedStep?.id : undefined,
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
            stepId: selectedStep?.id,
          },
        },
      })
      await retestConnection()
    }
  }, [
    selectedStep,
    selectedConnectionId,
    registerConnection,
    supportsConnectionRegistration,
    retestConnection,
  ])

  const onBack = () => {
    const triggersOrActions = selectedApp.triggers || selectedApp.actions || []
    if (triggersOrActions.length === 1) {
      updateModalState({ currentScreen: 'choose-app' })
    } else {
      updateModalState({ currentScreen: 'choose-event' })
    }
  }

  return (
    <>
      {/* No connection selected or step does not have both the key and appKey yet */}
      <ModalHeader>
        {(selectedConnectionId === '' ||
          (!selectedStep?.key && !selectedStep?.appKey)) && (
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
              onNextStep={onClose}
              onRegisterConnection={onRegisterConnection}
              readOnly={editorContext.readOnly}
              supportsConnectionRegistration={supportsConnectionRegistration}
              testResult={testConnectionData?.testConnection}
              testResultLoading={testResultLoading}
              registerConnectionLoading={registerConnectionLoading}
            />
          </Flex>
        </Flex>
      </ModalBody>
    </>
  )
}
