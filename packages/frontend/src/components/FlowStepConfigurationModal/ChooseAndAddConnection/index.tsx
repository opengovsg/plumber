import type { IApp, IConnection } from '@plumber/types'

import { useCallback, useContext, useMemo } from 'react'
import { useQuery } from '@apollo/client'

import { EditorContext } from '@/contexts/Editor'
import { GET_APP_CONNECTIONS } from '@/graphql/queries/get-app-connections'

import { FlowStepConfigurationContext } from '../FlowStepConfigurationContext'
import InvalidModalScreen from '../InvalidModalScreen'

import AddConnection from './AddConnection'
import ChooseConnection from './ChooseConnection'

interface ChooseAndAddConnectionProps {
  onClose: () => void
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
  const { onClose } = props
  const { flowId, onCreateStep, onUpdateStep } = useContext(EditorContext)
  const { modalState, patchModalState, step, prevStepId } = useContext(
    FlowStepConfigurationContext,
  )
  const { currentScreen, selectedApp, selectedEvent, selectedConnectionId } =
    modalState

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

  // This updates the mock step to be verified and registered
  const handleConnectionChange = useCallback(
    async (connectionId: string, shouldRefetch: boolean) => {
      if (!selectedApp || !selectedEvent) {
        return
      }

      if (shouldRefetch) {
        await refetch()
      }
      patchModalState({ selectedConnectionId: connectionId })
    },
    [selectedApp, selectedEvent, refetch, patchModalState],
  )

  // Add a new connection and update the mock step for verifying and registering of connection
  const handleAddConnection = useCallback(
    async (response: Record<string, any>) => {
      const newConnectionId = response?.createConnection?.id as
        | string
        | undefined

      if (newConnectionId) {
        if (!selectedApp || !selectedEvent) {
          return
        }

        handleConnectionChange(newConnectionId, true)
        patchModalState({
          selectedConnectionId: newConnectionId,
          currentScreen: 'choose-connection',
        })
      }
    },
    [handleConnectionChange, selectedApp, selectedEvent, patchModalState],
  )

  // If the step is not provided, create a new step; else update the existing step
  const handleSubmit = useCallback(async () => {
    if (!selectedApp || !selectedEvent || !selectedConnectionId) {
      return
    }

    patchModalState({ isLoading: true })
    try {
      if (prevStepId) {
        await onCreateStep(
          prevStepId,
          selectedApp.key,
          selectedEvent.key,
          selectedConnectionId,
        )
      } else if (step) {
        await onUpdateStep({
          ...step,
          appKey: selectedApp.key,
          key: selectedEvent.key,
          connection: {
            id: selectedConnectionId,
          },
        })
      }
      onClose()
    } finally {
      patchModalState({ isLoading: false })
    }
  }, [
    selectedApp,
    selectedEvent,
    selectedConnectionId,
    patchModalState,
    prevStepId,
    step,
    onCreateStep,
    onUpdateStep,
    onClose,
  ])

  if (!flowId) {
    return <InvalidModalScreen />
  }

  if (selectedApp && selectedEvent && currentScreen === 'choose-connection') {
    return (
      <ChooseConnection
        appConnectionsLoading={appConnectionsLoading}
        connectionOptions={connectionOptions}
        handleConnectionChange={handleConnectionChange}
        handleSubmit={handleSubmit}
      />
    )
  }
  if (selectedApp && currentScreen === 'add-connection') {
    return (
      <AddConnection
        onSubmit={handleAddConnection}
        onBack={() => patchModalState({ currentScreen: 'choose-connection' })}
      />
    )
  }

  return <InvalidModalScreen />
}
