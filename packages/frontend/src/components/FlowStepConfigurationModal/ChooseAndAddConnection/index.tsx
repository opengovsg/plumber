import { IApp, IConnection, IStep } from '@plumber/types'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useMutation, useQuery } from '@apollo/client'

import { GET_OR_CREATE_MOCK_STEP } from '@/graphql/mutations/get-or-create-mock-step'
import { GET_APP_CONNECTIONS } from '@/graphql/queries/get-app-connections'

import InvalidModalScreen from '../InvalidModalScreen'
import { type ModalState } from '..'

import AddConnection from './AddConnection'
import ChooseConnection from './ChooseConnection'

interface ChooseAndAddConnectionProps {
  onClose: () => void
  modalState: ModalState
  updateModalState: (newState: Partial<ModalState>) => void
  onUpdateStep: (step: IStep) => Promise<IStep>
  onCreateStep?: (
    appKey: string,
    eventKey: string,
    connectionId?: string,
  ) => Promise<IStep>
  step?: IStep
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
  const { currentScreen, selectedApp, selectedEvent, selectedConnectionId } =
    modalState
  const { flowId } = useParams()
  const [getOrCreateMockStep] = useMutation(GET_OR_CREATE_MOCK_STEP)
  const onGetOrCreateMockStep = useCallback(async () => {
    const { data } = await getOrCreateMockStep({
      variables: { input: { flowId } },
    })
    return data.getOrCreateMockStep as IStep
  }, [flowId, getOrCreateMockStep])

  const [mockStep, setMockStep] = useState<IStep | null>(null)
  useEffect(() => {
    // load mock step on mount
    if (!mockStep) {
      const fetchMockStep = async () => {
        setMockStep(await onGetOrCreateMockStep())
      }
      fetchMockStep()
    }
  }, [onGetOrCreateMockStep, mockStep])

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
      if (!selectedApp || !selectedEvent || !mockStep) {
        return
      }

      if (connectionId === mockStep?.connection?.id) {
        return
      }

      if (shouldRefetch) {
        await refetch()
      }

      const updatedMockStep = await onUpdateStep({
        ...mockStep,
        appKey: selectedApp.key,
        key: selectedEvent.key,
        connection: {
          id: connectionId,
        },
      })
      setMockStep(updatedMockStep)
      updateModalState({ selectedConnectionId: connectionId })
    },
    [
      mockStep,
      selectedApp,
      selectedEvent,
      onUpdateStep,
      refetch,
      setMockStep,
      updateModalState,
    ],
  )

  // Add a new connection and update the mock step for verifying and registering of connection
  const handleAddConnection = useCallback(
    async (response: Record<string, any>) => {
      const newConnectionId = response?.createConnection?.id as
        | string
        | undefined

      if (newConnectionId) {
        if (!selectedApp || !selectedEvent || !mockStep) {
          return
        }

        handleConnectionChange(newConnectionId, true)
        const updatedMockStep = await onUpdateStep({
          ...mockStep,
          appKey: selectedApp.key,
          key: selectedEvent.key,
          connection: {
            id: newConnectionId,
          },
        })
        setMockStep(updatedMockStep)
        updateModalState({
          selectedConnectionId: newConnectionId,
          currentScreen: 'choose-connection',
        })
      }
    },
    [
      handleConnectionChange,
      mockStep,
      onUpdateStep,
      selectedApp,
      selectedEvent,
      updateModalState,
    ],
  )

  // If the step is not provided, create a new step; else update the existing step
  const handleSubmit = useCallback(() => {
    if (!selectedApp || !selectedEvent || !selectedConnectionId) {
      return
    }

    updateModalState({ isLoading: true })
    if (onCreateStep) {
      onCreateStep(selectedApp.key, selectedEvent.key, selectedConnectionId)
    } else if (step) {
      onUpdateStep({
        ...step,
        appKey: selectedApp.key,
        key: selectedEvent.key,
        connection: {
          id: selectedConnectionId,
        },
      })
    }
    // For a better visual experience, delay the closing of the modal
    setTimeout(() => {
      updateModalState({ isLoading: false })
      onClose()
    }, 500)
  }, [
    selectedApp,
    selectedEvent,
    selectedConnectionId,
    onCreateStep,
    step,
    onClose,
    onUpdateStep,
    updateModalState,
  ])

  if (selectedApp && selectedEvent && currentScreen === 'choose-connection') {
    return (
      <ChooseConnection
        selectedApp={selectedApp}
        selectedConnectionId={selectedConnectionId}
        updateModalState={updateModalState}
        appConnectionsLoading={appConnectionsLoading}
        connectionOptions={connectionOptions}
        handleConnectionChange={handleConnectionChange}
        handleSubmit={handleSubmit}
        mockStep={mockStep ?? undefined}
        step={step}
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
