import { type IAction, IApp, IStep, ITrigger } from '@plumber/types'

import { useCallback, useMemo } from 'react'
import { useQuery } from '@apollo/client'

import { GET_APP_CONNECTIONS } from '@/graphql/queries/get-app-connections'
import { GET_APPS } from '@/graphql/queries/get-apps'
import {
  TOOLBOX_ACTIONS,
  TOOLBOX_APP_KEY,
  useIfThenInitializer,
} from '@/helpers/toolbox'

import type { ModalScreen, ModalState } from '..'
import { APP_ALLOWING_EMPTY_CONNECTION, EXCEL_APP_KEY } from '../constants'
import InvalidModalScreen from '../InvalidModalScreen'

import ChooseApp from './ChooseApp'
import ChooseEvent from './ChooseEvent'

type ChooseAppAndEventProps = {
  onClose: () => void
  isTrigger: boolean
  isLastStep: boolean
  modalState: ModalState
  updateModalState: (newState: Partial<ModalState>) => void
  onUpdateStep: (step: IStep) => Promise<IStep>
  onCreateStep?: (
    appKey: string,
    eventKey: string,
    connectionId?: string,
  ) => Promise<IStep>
  step?: IStep
  initialScreen?: ModalScreen
}

export default function ChooseAppAndEvent(props: ChooseAppAndEventProps) {
  const {
    onClose,
    isTrigger,
    isLastStep,
    modalState,
    updateModalState,
    onUpdateStep,
    onCreateStep,
    step,
    initialScreen,
  } = props
  const { currentScreen, selectedApp } = modalState

  const { data } = useQuery(GET_APPS)
  const apps: IApp[] = data?.getApps?.filter((app: IApp) =>
    isTrigger ? !!app.triggers?.length : !!app.actions?.length,
  )

  // This is used for specifically Excel connections (to skip the connection configuration modal)
  const { data: appConnectionsData } = useQuery(GET_APP_CONNECTIONS, {
    variables: { key: selectedApp?.key },
    skip: !selectedApp,
  })
  // Check and return the one and only Excel connection
  const excelConnection = useMemo(() => {
    if (selectedApp?.key !== EXCEL_APP_KEY) {
      return null
    }

    const excelConnections = appConnectionsData?.getApp?.connections ?? []
    if (excelConnections.length === 0) {
      return null
    }

    // TODO: Remove this once we have a better way to handle multiple connections
    if (excelConnections.length > 1) {
      console.error(
        'Multiple connections found for Excel. Please contact support@plumber.gov.sg for assistance.',
      )
    }
    return excelConnections[0]
  }, [selectedApp, appConnectionsData])

  const [initializeIfThen] = useIfThenInitializer()
  /**
   * Note: App without connections will skip the connection modal screen (custom-api included)
   * App with connections will be directed to the connection modal screen
   * Exception: M365 will go through a different configuration screen if not verified before.
   * Else (once verified before), it will skip the connection modal screen.
   */
  const onSelectAppEvent = useCallback(
    async (app: IApp, triggerOrAction: ITrigger | IAction) => {
      if (
        app.auth &&
        app.key !== APP_ALLOWING_EMPTY_CONNECTION &&
        !excelConnection?.verified
      ) {
        if (app.key === EXCEL_APP_KEY) {
          updateModalState({
            selectedApp: app,
            selectedEvent: triggerOrAction,
            selectedConnectionId: excelConnection?.id,
            currentScreen: 'configure-excel-connection',
          })
        } else {
          updateModalState({
            selectedApp: app,
            selectedEvent: triggerOrAction,
            currentScreen: 'choose-connection',
          })
        }
        return
      }
      // If the app has no connections, create or update a new step and close the modal
      // Exception: M365 will auto connect if verified once...
      updateModalState({ isLoading: true })
      if (onCreateStep) {
        await onCreateStep(
          app.key,
          triggerOrAction.key,
          excelConnection?.id || undefined,
        )
      } else if (step) {
        // account for the if-then edge case
        if (
          app.key === TOOLBOX_APP_KEY &&
          triggerOrAction.key === TOOLBOX_ACTIONS.IfThen
        ) {
          await initializeIfThen(step)
        } else {
          await onUpdateStep({
            ...step,
            appKey: app.key,
            key: triggerOrAction.key,
            connection: {
              id: excelConnection?.id || undefined,
            },
          })
        }
      }
      // For a better visual experience, delay the closing of the modal
      setTimeout(() => {
        updateModalState({ isLoading: false })
        onClose()
      }, 500)
    },
    [
      excelConnection?.verified,
      excelConnection?.id,
      updateModalState,
      onCreateStep,
      step,
      initializeIfThen,
      onUpdateStep,
      onClose,
    ],
  )

  if (currentScreen === 'choose-app') {
    return (
      <ChooseApp
        apps={apps}
        isTrigger={isTrigger}
        onSelectApp={(app: IApp) => {
          updateModalState({
            selectedApp: app,
            currentScreen: 'choose-event',
          })
        }}
        onSelectAppEvent={onSelectAppEvent}
      />
    )
  } else if (selectedApp && currentScreen === 'choose-event') {
    return (
      <ChooseEvent
        selectedApp={selectedApp}
        isTrigger={isTrigger}
        isLastStep={isLastStep}
        onSelectAppEvent={onSelectAppEvent}
        onBack={() => {
          updateModalState({
            selectedApp: null,
            selectedEvent: null,
            selectedConnectionId: '',
            currentScreen: 'choose-app',
          })
        }}
        initialScreen={initialScreen}
      />
    )
  } else {
    return <InvalidModalScreen />
  }
}
