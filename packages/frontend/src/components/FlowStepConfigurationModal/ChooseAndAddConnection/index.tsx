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
  description?: string
}

// For FormSG, it will generate a label with the form title and the description with the form id
// Note: doing this on the frontend instead because of backwards compatibility whereby
// only re-verifying the connection on the backend will update the connection formattedData (inconsistency)
export const optionGenerator = (
  connection: Partial<IConnection>,
  appKey: string,
): ConnectionDropdownOption => {
  const screenName = connection?.formattedData?.screenName as string
  if (appKey === 'formsg') {
    // parse the screenName to get the env, formId, and formTitle
    const [envWithFormId, formTitle] = screenName.split(' - ')
    let env = ''
    let formId = envWithFormId
    if (envWithFormId.startsWith('[')) {
      const endIndex = envWithFormId.indexOf(']')
      env = envWithFormId.substring(0, endIndex + 1) + ' '
      formId = envWithFormId.substring(endIndex + 2) // skip "]"
    }

    return {
      label: `${env}${formTitle}`,
      value: connection?.id as string,
      description: formId,
    }
  }

  return {
    label: screenName ?? 'Unnamed',
    value: connection?.id as string,
  }
}

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

  const onUpdateAndSetMockStep = useCallback(
    async (step: IStep, newConnectionId?: string) => {
      const updatedMockStep = await onUpdateStep({
        ...step,
        appKey: selectedApp?.key,
        key: selectedEvent?.key,
        connection: {
          id: newConnectionId ?? selectedConnectionId,
        },
      })
      setMockStep(updatedMockStep)
      return updatedMockStep
    },
    [onUpdateStep, selectedConnectionId, selectedApp, selectedEvent],
  )

  useEffect(() => {
    // load mock step on mount with selected connection id if present
    if (!mockStep) {
      const fetchMockStep = async () => {
        const returnedMockStep = await onGetOrCreateMockStep()
        if (selectedConnectionId) {
          await onUpdateAndSetMockStep(returnedMockStep)
        } else {
          setMockStep(returnedMockStep)
        }
      }
      fetchMockStep()
    }
  }, [
    onGetOrCreateMockStep,
    mockStep,
    onUpdateAndSetMockStep,
    selectedConnectionId,
  ])

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
        optionGenerator(connection, appWithConnections.key),
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

      await onUpdateAndSetMockStep(mockStep, connectionId)
      updateModalState({ selectedConnectionId: connectionId })
    },
    [
      mockStep,
      selectedApp,
      selectedEvent,
      refetch,
      updateModalState,
      onUpdateAndSetMockStep,
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
        await onUpdateAndSetMockStep(mockStep, newConnectionId)
        updateModalState({
          selectedConnectionId: newConnectionId,
          currentScreen: 'choose-connection',
        })
      }
    },
    [
      handleConnectionChange,
      mockStep,
      onUpdateAndSetMockStep,
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
