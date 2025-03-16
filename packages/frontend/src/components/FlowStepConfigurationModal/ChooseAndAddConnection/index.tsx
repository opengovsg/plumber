import { IApp, IConnection, IStep } from '@plumber/types'

import { useCallback, useMemo, useState } from 'react'
import { useQuery } from '@apollo/client'

import { GET_APP_CONNECTIONS } from '@/graphql/queries/get-app-connections'

import InvalidModalScreen from '../InvalidModalScreen'
import { type ModalState } from '..'

import AddConnection from './AddConnection'
import ChooseConnection from './ChooseConnection'

interface ChooseAndAddConnectionProps {
  onClose: () => void
  modalState: ModalState
  updateModalState: (newState: Partial<ModalState>) => void
  step: IStep | null
  onUpdateStep: (step: IStep) => Promise<IStep>
  onCreateStep?: (
    appKey: string,
    eventKey: string,
    connectionId?: string,
  ) => Promise<IStep>
}

export type ConnectionDropdownOption = {
  label: string
  value: string
}

const optionGenerator = (
  connection: IConnection,
): ConnectionDropdownOption => ({
  label: (connection?.formattedData?.screenName as string) ?? 'Unnamed',
  value: connection?.id as string,
})

export default function ChooseAndAddConnection(
  props: ChooseAndAddConnectionProps,
) {
  const {
    onClose,
    modalState,
    updateModalState,
    step,
    onUpdateStep,
    onCreateStep,
  } = props
  const { currentScreen, selectedApp, selectedEvent } = modalState

  const [selectedStep, setSelectedStep] = useState<IStep | null>(step)
  const [selectedConnectionId, setSelectedConnectionId] = useState<string>(
    selectedStep?.connection?.id ?? '',
  )

  const {
    data,
    loading: appConnectionsLoading,
    refetch,
  } = useQuery(GET_APP_CONNECTIONS, {
    variables: { key: selectedApp?.key },
    skip: !selectedApp,
  })

  const connectionOptions = useMemo(() => {
    const appWithConnections = data?.getApp as IApp
    const options =
      appWithConnections?.connections?.map((connection) =>
        optionGenerator(connection),
      ) || []

    return options
  }, [data])

  const handleConnectionChange = useCallback(
    async (connectionId: string, shouldRefetch: boolean) => {
      if (!selectedApp || !selectedEvent) {
        return
      }

      if (!selectedStep) {
        if (onCreateStep) {
          const newStep = await onCreateStep(
            selectedApp.key,
            selectedEvent.key,
            connectionId,
          )
          setSelectedStep(newStep)
          setSelectedConnectionId(connectionId)
        }
        return
      }

      if (connectionId === selectedStep?.connection?.id) {
        return
      }

      if (shouldRefetch) {
        await refetch()
      }

      const updatedStep = await onUpdateStep({
        ...selectedStep,
        appKey: selectedApp.key,
        key: selectedEvent.key,
        connection: {
          id: connectionId,
        },
      })
      setSelectedStep(updatedStep)
      setSelectedConnectionId(connectionId)
    },
    [
      selectedStep,
      selectedApp,
      selectedEvent,
      onUpdateStep,
      refetch,
      setSelectedStep,
      onCreateStep,
    ],
  )

  const handleAddConnection = useCallback(
    (response: Record<string, any>) => {
      const newConnectionId = response?.createConnection?.id as
        | string
        | undefined
      if (newConnectionId) {
        handleConnectionChange(newConnectionId, true)
        setSelectedConnectionId(newConnectionId)
        updateModalState({ currentScreen: 'choose-connection' })
      }
    },
    [handleConnectionChange, setSelectedConnectionId, updateModalState],
  )

  if (selectedApp && selectedEvent && currentScreen === 'choose-connection') {
    return (
      <ChooseConnection
        onClose={onClose}
        selectedApp={selectedApp}
        updateModalState={updateModalState}
        selectedStep={selectedStep}
        selectedConnectionId={selectedConnectionId}
        appConnectionsLoading={appConnectionsLoading}
        connectionOptions={connectionOptions}
        handleConnectionChange={handleConnectionChange}
      />
    )
  } else if (selectedApp && currentScreen === 'add-connection') {
    return (
      <AddConnection
        onSubmit={handleAddConnection}
        selectedApp={selectedApp}
        onBack={() => updateModalState({ currentScreen: 'choose-connection' })}
      />
    )
  } else {
    return <InvalidModalScreen />
  }
}
