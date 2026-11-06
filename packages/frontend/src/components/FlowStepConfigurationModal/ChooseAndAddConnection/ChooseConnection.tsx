import { Flex, ModalBody, ModalHeader, Text } from '@chakra-ui/react'
import { ModalCloseButton } from '@opengovsg/design-system-react'
import { useContext } from 'react'

import { EditorContext } from '@/contexts/Editor'
import { LaunchDarklyContext } from '@/contexts/LaunchDarkly'

import { ConnectionDropdownOption } from '.'
import BackButton from '../BackButton'
import { DEFAULT_CHOOSE_CONNECTION_LABEL } from '../constants'
import { FlowStepConfigurationContext } from '../FlowStepConfigurationContext'
import { getSelectableActions } from '../helpers/selectable-actions'
import InvalidModalScreen from '../InvalidModalScreen'
import ChooseConnectionDropdown from './ChooseConnectionDropdown'
import ConnectionHeader from './ConnectionHeader'
import SetConnectionButton from './SetConnectionButton'

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
  const { getFlagValue } = useContext(LaunchDarklyContext)

  const { modalState, patchModalState, step } = useContext(
    FlowStepConfigurationContext,
  )
  const { selectedApp, selectedConnectionId } = modalState
  const connectionModalLabel = selectedApp?.auth?.connectionModalLabel

  const isStepAbsent = !step?.key || !step?.appKey

  const onBack = () => {
    if (!selectedApp) {
      return
    }

    const triggersOrActions = selectedApp.triggers
      ? selectedApp.triggers
      : getSelectableActions(selectedApp, getFlagValue)
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
      <ModalHeader pt={0} mt={isStepAbsent ? -4 : 0}>
        {isStepAbsent && <BackButton onBack={onBack} />}
        <ConnectionHeader
          selectedApp={selectedApp}
          headerText={
            connectionModalLabel?.chooseConnectionLabel ??
            DEFAULT_CHOOSE_CONNECTION_LABEL
          }
        />
      </ModalHeader>
      <ModalCloseButton
        mt={2}
        size="xs"
        colorScheme="secondary"
        sx={{ svg: { boxSize: 6 } }}
      />

      <ModalBody pb={0} mb={-2}>
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
            {connectionModalLabel?.termsNote && (
              <Text
                textStyle="body-2"
                color="base.content.medium"
                mt={2}
                sx={{ textWrap: 'pretty' }}
              >
                {connectionModalLabel.termsNote}
              </Text>
            )}
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
