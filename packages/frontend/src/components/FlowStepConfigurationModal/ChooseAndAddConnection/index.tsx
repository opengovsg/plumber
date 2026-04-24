import type { IApp, IConnection } from '@plumber/types'

import { useCallback, useContext, useMemo } from 'react'
import { useQuery } from '@apollo/client'

import { EditorContext } from '@/contexts/Editor'
import { MrfContext } from '@/contexts/MrfContext'
import { GET_APP_CONNECTIONS } from '@/graphql/queries/get-app-connections'
import { getMrfApprovalConfig } from '@/helpers/formsg'

import { DATABRICKS_APP_KEY, EXCEL_APP_KEY } from '../constants'
import { FlowStepConfigurationContext } from '../FlowStepConfigurationContext'
import InvalidModalScreen from '../InvalidModalScreen'

import AddConnection from './AddConnection'
import ChooseConnection from './ChooseConnection'
import ConfigureDatabricksConnection from './ConfigureDatabricksConnection'
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
    description: connection?.description ?? undefined,
    env: connection?.formattedData?.env as string | undefined,
  }
}

export default function ChooseAndAddConnection(
  props: ChooseAndAddConnectionProps,
) {
  const { onClose } = props
  const {
    flow,
    flowId,
    onCreateStep,
    onDrawerOpen,
    onUpdateStep,
    setCurrentStepId,
    executeTestStep,
  } = useContext(EditorContext)
  const { modalState, patchModalState, step, prevStep } = useContext(
    FlowStepConfigurationContext,
  )

  const { approvalBranches } = useContext(MrfContext)
  const { currentScreen, selectedApp, selectedEvent } = modalState

  const {
    data,
    loading: appConnectionsLoading,
    refetch,
  } = useQuery(GET_APP_CONNECTIONS, {
    variables: {
      key: selectedApp?.key,
      flowId: flow.id,
    },
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
      try {
        if (prevStep) {
          const approvalConfig = getMrfApprovalConfig({
            previousStep: prevStep,
            approvalBranches: approvalBranches,
          })
          const createdStep = await onCreateStep(
            prevStep.id,
            selectedApp.key,
            selectedEvent.key,
            connectionId,
            approvalConfig && { approval: approvalConfig },
          )
          newStepId = createdStep.id
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
        }
        onClose()
        onDrawerOpen()
        setCurrentStepId(newStepId)
        if (selectedApp?.auth?.autoCheckStep && newStepId) {
          // need to deliberately set the step id because
          // closure of executeTestStep may still hold reference to old step id
          executeTestStep({ stepId: newStepId })
        }
      } catch (error) {
        console.error('Error selecting app and event', error)
      } finally {
        patchModalState({ isLoading: false })
      }
    },
    [
      selectedApp,
      selectedEvent,
      patchModalState,
      prevStep,
      step,
      onClose,
      onDrawerOpen,
      setCurrentStepId,
      approvalBranches,
      onCreateStep,
      onUpdateStep,
      executeTestStep,
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

  if (
    selectedApp?.key === DATABRICKS_APP_KEY &&
    selectedEvent &&
    currentScreen === 'configure-databricks-connection'
  ) {
    return (
      <ConfigureDatabricksConnection
        onBack={() => patchModalState({ currentScreen: 'choose-event' })}
        onCreateOrUpdateStep={onCreateOrUpdateStep}
      />
    )
  }

  return <InvalidModalScreen />
}
