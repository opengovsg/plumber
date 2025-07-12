import { type IAction, IApp, ITrigger } from '@plumber/types'

import { useCallback, useContext, useMemo } from 'react'
import { useQuery } from '@apollo/client'

import { EditorContext } from '@/contexts/Editor'
import { GET_APP_CONNECTIONS } from '@/graphql/queries/get-app-connections'
import {
  TOOLBOX_ACTIONS,
  TOOLBOX_APP_KEY,
  useForEachInitializer,
  useIfThenInitializer,
} from '@/helpers/toolbox'

import { APP_ALLOWING_EMPTY_CONNECTION, EXCEL_APP_KEY } from '../constants'
import { FlowStepConfigurationContext } from '../FlowStepConfigurationContext'
import InvalidModalScreen from '../InvalidModalScreen'

import ChooseApp from './ChooseApp'
import ChooseEvent from './ChooseEvent'

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
    setCurrentStepIndex,
  } = useContext(EditorContext)

  const { modalState, patchModalState, prevStepId, isTrigger, step } =
    useContext(FlowStepConfigurationContext)

  const { currentScreen, selectedApp } = modalState

  const apps: IApp[] = allApps.filter((app: IApp) =>
    isTrigger ? !!app.triggers?.length : !!app.actions?.length,
  )

  // This is used for specifically Excel connections (to skip the connection configuration modal)
  const { data: appConnectionsData } = useQuery(GET_APP_CONNECTIONS, {
    variables: { key: selectedApp?.key },
    skip: selectedApp?.key !== EXCEL_APP_KEY,
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

  const [initializeForEach] = useForEachInitializer()
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
          patchModalState({
            selectedApp: app,
            selectedEvent: triggerOrAction,
            selectedConnectionId: excelConnection?.id,
            currentScreen: 'configure-excel-connection',
          })
        } else {
          patchModalState({
            selectedApp: app,
            selectedEvent: triggerOrAction,
            currentScreen: 'choose-connection',
          })
        }
        return
      }

      // If the app has no connections, create or update a new step and close the modal
      // Exception: M365 will auto connect if verified once...
      patchModalState({ isLoading: true })
      let newStepId = null
      let newStepIndex = null
      if (prevStepId) {
        const createdStep = await onCreateStep(
          prevStepId,
          app.key,
          triggerOrAction.key,
          excelConnection?.id || undefined,
        )
        newStepId = createdStep.id
        newStepIndex = createdStep.position - 1
      } else if (step) {
        // account for the if-then edge case
        if (
          app.key === TOOLBOX_APP_KEY &&
          triggerOrAction.key === TOOLBOX_ACTIONS.IfThen
        ) {
          const ifThen = await initializeIfThen(step)
          newStepId = ifThen.id
          newStepIndex = ifThen.position - 1
        } else {
          const updatedStep = await onUpdateStep({
            ...step,
            appKey: app.key,
            key: triggerOrAction.key,
            connection: {
              id: excelConnection?.id || undefined,
            },
          })
          newStepId = updatedStep.id
          newStepIndex = updatedStep.position - 1

          // account for for-each
          if (triggerOrAction.key === TOOLBOX_ACTIONS.ForEach) {
            await initializeForEach(step)
          }
        }
      }
      patchModalState({ isLoading: false })
      onClose()
      onDrawerOpen()
      setCurrentStepId(newStepId)
      setCurrentStepIndex(newStepIndex)
    },
    [
      excelConnection?.verified,
      excelConnection?.id,
      patchModalState,
      prevStepId,
      step,
      onClose,
      onDrawerOpen,
      setCurrentStepId,
      setCurrentStepIndex,
      onCreateStep,
      initializeIfThen,
      onUpdateStep,
      initializeForEach,
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
