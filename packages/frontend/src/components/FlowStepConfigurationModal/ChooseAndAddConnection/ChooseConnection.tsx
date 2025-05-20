import { useContext } from 'react'
import { Flex, ModalBody, ModalHeader } from '@chakra-ui/react'
import { ModalCloseButton } from '@opengovsg/design-system-react'

import { EditorContext } from '@/contexts/Editor'

import BackButton from '../BackButton'
import { DEFAULT_CHOOSE_CONNECTION_LABEL } from '../constants'
import { FlowStepConfigurationContext } from '../FlowStepConfigurationContext'
import InvalidModalScreen from '../InvalidModalScreen'

import ChooseConnectionDropdown from './ChooseConnectionDropdown'
import ConnectionHeader from './ConnectionHeader'
import SetConnectionButton from './SetConnectionButton'
import { ConnectionDropdownOption } from '.'

interface ChooseConnectionProps {
  appConnectionsLoading: boolean
  connectionOptions: ConnectionDropdownOption[]
  handleConnectionChange: (
    value: string,
    shouldRefetch: boolean,
  ) => Promise<void>
  onCreateOrUpdateStep: (connectionId: string) => Promise<void>
}

export default function ChooseConnection(
  props: ChooseConnectionProps,
): JSX.Element {
  const {
    appConnectionsLoading,
    connectionOptions,
    handleConnectionChange,
    onCreateOrUpdateStep,
  } = props
  const { readOnly } = useContext(EditorContext)

  const { modalState, patchModalState, step } = useContext(
    FlowStepConfigurationContext,
  )
  const { selectedApp, selectedConnectionId } = modalState
  const connectionModalLabel = selectedApp?.auth?.connectionModalLabel

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
      <ModalHeader pt={0} mt={-4}>
        {(!step?.key || !step?.appKey) && <BackButton onBack={onBack} />}
        <ConnectionHeader
          selectedApp={selectedApp}
          headerText={
            connectionModalLabel?.chooseConnectionLabel ??
            DEFAULT_CHOOSE_CONNECTION_LABEL
          }
        />
      </ModalHeader>
      <ModalCloseButton mt={2} size="xs" colorScheme="secondary" />

      <ModalBody>
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
              onNextStep={async () =>
                await onCreateOrUpdateStep(selectedConnectionId)
              }
              readOnly={readOnly}
              isNewStep={!step?.appKey || !step?.key}
            />
          </Flex>
        </Flex>
      </ModalBody>
    </>
  )
}
