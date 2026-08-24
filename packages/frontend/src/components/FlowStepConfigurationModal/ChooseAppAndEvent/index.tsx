import { useLazyQuery } from '@apollo/client'
import { type IAction, IApp, ITrigger } from '@plumber/types'
import { useCallback, useContext } from 'react'

import { EditorContext } from '@/contexts/Editor'
import { MrfContext } from '@/contexts/MrfContext'
import client from '@/graphql/client'
import { GET_APP_CONNECTIONS } from '@/graphql/queries/get-app-connections'
import { GET_FLOW } from '@/graphql/queries/get-flow'
import { getMrfApprovalConfig } from '@/helpers/formsg'
import {
  TOOLBOX_ACTIONS,
  TOOLBOX_APP_KEY,
  useIfThenInitializer,
} from '@/helpers/toolbox'

import {
  APP_ALLOWING_EMPTY_CONNECTION,
  DATABRICKS_APP_KEY,
  EXCEL_APP_KEY,
} from '../constants'
import {
  FlowStepConfigurationContext,
  ModalScreen,
} from '../FlowStepConfigurationContext'
import InvalidModalScreen from '../InvalidModalScreen'
import ChooseApp from './ChooseApp'
import ChooseEvent from './ChooseEvent'

const SYSTEM_ADDED_CONFIGURE_SCREEN: Record<string, ModalScreen> = {
  [EXCEL_APP_KEY]: 'configure-excel-connection',
  [DATABRICKS_APP_KEY]: 'configure-databricks-connection',
}

type ChooseAppAndEventProps = {
  onClose: () => void
}

export default function ChooseAppAndEvent(props: ChooseAppAndEventProps) {
  const { onClose } = props

  const {
    onUpdateStep,
    onCreateStep,
    allApps,
    onDrawerOpen,
    setCurrentStepId,
    flowId,
  } = useContext(EditorContext)

  const { modalState, patchModalState, prevStep, isTrigger, step } = useContext(
    FlowStepConfigurationContext,
  )
  const { approvalBranches } = useContext(MrfContext)

  const { currentScreen, selectedApp } = modalState

  const apps: IApp[] = allApps.filter((app: IApp) =>
    isTrigger ? !!app.triggers?.length : !!app.actions?.length,
  )

  const [fetchAppConnections] = useLazyQuery(GET_APP_CONNECTIONS)

  const [initializeIfThen] = useIfThenInitializer()

  /**
   * Note: App without connections will skip the connection modal screen (custom-api included)
   * App with connections will be directed to the connection modal screen
   * Exception: M365 will go through a different configuration screen if not verified before.
   * Else (once verified before), it will skip the connection modal screen.
   */
  const onSelectAppEvent = useCallback(
    async (app: IApp, triggerOrAction: ITrigger | IAction) => {
      const configureScreen = SYSTEM_ADDED_CONFIGURE_SCREEN[app.key]
      let systemConnection: { id?: string; verified?: boolean } | null = null
      if (configureScreen) {
        const { data: appConnectionsData } = await fetchAppConnections({
          variables: { key: app.key, flowId },
        })
        const connections = appConnectionsData?.getApp?.connections ?? []
        systemConnection = connections[0] ?? null

        if (connections.length > 1 && app.key === EXCEL_APP_KEY) {
          console.error(
            'Multiple connections found for Excel. Please visit https://go.gov.sg/plumber-support for assistance.',
          )
        }

        if (
          app.auth &&
          !triggerOrAction.noAuthRequired &&
          !systemConnection?.verified
        ) {
          patchModalState({
            selectedApp: app,
            selectedEvent: triggerOrAction,
            selectedConnectionId: systemConnection?.id,
            currentScreen: configureScreen,
          })
          return
        }
      } else if (
        app.auth &&
        !triggerOrAction.noAuthRequired &&
        app.key !== APP_ALLOWING_EMPTY_CONNECTION
      ) {
        patchModalState({
          selectedApp: app,
          selectedEvent: triggerOrAction,
          currentScreen: 'choose-connection',
        })
        return
      }

      // If the app has no connections, create or update a new step and close the modal
      // Exception: M365 will auto connect if verified once...
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
            app.key,
            triggerOrAction.key,
            systemConnection?.id || undefined,
            approvalConfig && { approval: approvalConfig },
          )
          newStepId = createdStep.id
        } else if (step) {
          // This part of the code happens when updating an empty step
          // account for the if-then edge case
          if (
            app.key === TOOLBOX_APP_KEY &&
            triggerOrAction.key === TOOLBOX_ACTIONS.IfThen
          ) {
            const ifThen = await initializeIfThen(step)
            newStepId = ifThen.id
          } else {
            const updatedStep = await onUpdateStep({
              ...step,
              appKey: app.key,
              key: triggerOrAction.key,
              connection: {
                id: systemConnection?.id || undefined,
              },
            })
            newStepId = updatedStep.id
          }
          // we refetch GET_FLOW after everything is completed
          await client.refetchQueries({ include: [GET_FLOW] })
        }
        onClose()
        onDrawerOpen()
        setCurrentStepId(newStepId)
      } catch (error) {
        console.error('Error selecting app and event', error)
      } finally {
        patchModalState({ isLoading: false })
      }
    },
    [
      fetchAppConnections,
      flowId,
      patchModalState,
      prevStep,
      step,
      onClose,
      onDrawerOpen,
      setCurrentStepId,
      approvalBranches,
      onCreateStep,
      initializeIfThen,
      onUpdateStep,
    ],
  )

  if (currentScreen === 'choose-app') {
    return <ChooseApp apps={apps} onSelectAppEvent={onSelectAppEvent} />
  } else if (selectedApp && currentScreen === 'choose-event') {
    return <ChooseEvent onSelectAppEvent={onSelectAppEvent} />
  } else {
    return <InvalidModalScreen />
  }
}
