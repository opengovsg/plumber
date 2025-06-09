import type { IApp, IConnection } from '@plumber/types'

import { useCallback, useContext, useMemo } from 'react'
import { useQuery } from '@apollo/client'

import { EditorContext } from '@/contexts/Editor'
import { GET_APP_CONNECTIONS } from '@/graphql/queries/get-app-connections'

import { EXCEL_APP_KEY } from '../constants'
import { FlowStepConfigurationContext } from '../FlowStepConfigurationContext'
import InvalidModalScreen from '../InvalidModalScreen'

import AddConnection from './AddConnection'
import ChooseConnection from './ChooseConnection'
import ConfigureExcelConnection from './ConfigureExcelConnection'

interface ChooseAndAddConnectionProps {
  onClose: () => void
}

export type ConnectionDropdownOption = {
  label: string
  value: string
  description?: string
  env?: string // only used for FormSG now
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
    // old form connections will have env as undefined and be treated as prod
    const env = (connection?.formattedData?.env as string) ?? 'prod'

    // parse the screenName to get the env, formId, and formTitle
    const [envWithFormId, formTitle] = screenName.split(' - ')
    let formId = envWithFormId
    // only if the env is not prod, we need to parse the env from the screenName
    if (env !== 'prod') {
      const endIndex = envWithFormId.indexOf(']')
      formId = envWithFormId.substring(endIndex + 2) // skip "]"
    }

    return {
      label: `${env === 'prod' ? '' : `[${env.toUpperCase()}] `}${formTitle}`,
      value: connection?.id as string,
      description: formId,
      env,
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
  const { onClose } = props
  const {
    flowId,
    onCreateStep,
    onDrawerOpen,
    onUpdateStep,
    setCurrentStepId,
    setCurrentStepIndex,
  } = useContext(EditorContext)
  const { modalState, patchModalState, step, prevStepId } = useContext(
    FlowStepConfigurationContext,
  )
  const { currentScreen, selectedApp, selectedEvent } = modalState

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

  // If the step is not provided, create a new step; else update the existing step
  const onCreateOrUpdateStep = useCallback(
    async (connectionId: string) => {
      if (!selectedApp || !selectedEvent || !connectionId) {
        return
      }

      patchModalState({ isLoading: true })
      let newStepId = null
      let newStepIndex = null
      try {
        if (prevStepId) {
          const createdStep = await onCreateStep(
            prevStepId,
            selectedApp.key,
            selectedEvent.key,
            connectionId,
          )
          newStepId = createdStep.id
          newStepIndex = createdStep.position - 1
        } else if (step) {
          const updatedStep = await onUpdateStep({
            ...step,
            appKey: selectedApp.key,
            key: selectedEvent.key,
            connection: {
              id: connectionId,
            },
          })
          newStepId = updatedStep.id
          newStepIndex = Math.max(1, updatedStep.position - 1)
        }
        onClose()
      } finally {
        patchModalState({ isLoading: false })
        onDrawerOpen()
        setCurrentStepId(newStepId)
        setCurrentStepIndex(newStepIndex)
      }
    },
    [
      selectedApp,
      selectedEvent,
      patchModalState,
      prevStepId,
      step,
      onClose,
      onCreateStep,
      onUpdateStep,
      onDrawerOpen,
      setCurrentStepId,
      setCurrentStepIndex,
    ],
  )

  if (!flowId) {
    return <InvalidModalScreen />
  }

  if (selectedApp && selectedEvent && currentScreen === 'choose-connection') {
    return (
      <ChooseConnection
        appConnectionsLoading={appConnectionsLoading}
        connectionOptions={connectionOptions}
        handleConnectionChange={handleConnectionChange}
        onCreateOrUpdateStep={onCreateOrUpdateStep}
      />
    )
  }
  if (selectedApp && currentScreen === 'add-connection') {
    return (
      <AddConnection
        handleConnectionChange={handleConnectionChange}
        onCreateOrUpdateStep={onCreateOrUpdateStep}
      />
    )
  }

  if (
    selectedApp?.key === EXCEL_APP_KEY &&
    selectedEvent &&
    currentScreen === 'configure-excel-connection'
  ) {
    return (
      <ConfigureExcelConnection
        onBack={() => patchModalState({ currentScreen: 'choose-event' })}
        onCreateOrUpdateStep={onCreateOrUpdateStep}
      />
    )
  }

  return <InvalidModalScreen />
}
