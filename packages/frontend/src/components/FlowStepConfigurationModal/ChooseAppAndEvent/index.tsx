import { type IAction, IApp, ITrigger } from '@plumber/types'

import { useCallback, useContext } from 'react'
import { useQuery } from '@apollo/client'

import { EditorContext } from '@/contexts/Editor'
import { GET_APPS } from '@/graphql/queries/get-apps'
import {
  TOOLBOX_ACTIONS,
  TOOLBOX_APP_KEY,
  useIfThenInitializer,
} from '@/helpers/toolbox'

import { APP_ALLOWING_EMPTY_CONNECTION } from '../constants'
import { FlowStepConfigurationContext } from '../FlowStepConfigurationContext'
import InvalidModalScreen from '../InvalidModalScreen'

import ChooseApp from './ChooseApp'
import ChooseEvent from './ChooseEvent'

type ChooseAppAndEventProps = {
  onClose: () => void
}

export default function ChooseAppAndEvent(props: ChooseAppAndEventProps) {
  const { onClose } = props

  const { onUpdateStep, onCreateStep } = useContext(EditorContext)

  const {
    modalState,
    patchModalState,
    prevStepId,
    isLastStep,
    isTrigger,
    step,
  } = useContext(FlowStepConfigurationContext)

  const { currentScreen, selectedApp } = modalState

  const { data } = useQuery(GET_APPS)
  const apps: IApp[] = data?.getApps?.filter((app: IApp) =>
    isTrigger ? !!app.triggers?.length : !!app.actions?.length,
  )

  const [initializeIfThen] = useIfThenInitializer()
  const onSelectAppEvent = useCallback(
    async (app: IApp, triggerOrAction: ITrigger | IAction) => {
      if (app.auth && app.key !== APP_ALLOWING_EMPTY_CONNECTION) {
        patchModalState({
          selectedApp: app,
          selectedEvent: triggerOrAction,
          currentScreen: 'choose-connection',
        })
        return
      }
      // If the app has no connections, create or update a new step and close the modal
      patchModalState({ isLoading: true })
      if (prevStepId) {
        await onCreateStep(prevStepId, app.key, triggerOrAction.key)
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
          })
        }
      }
      // For a better visual experience, delay the closing of the modal
      setTimeout(() => {
        patchModalState({ isLoading: false })
        onClose()
      }, 500)
    },
    [
      patchModalState,
      prevStepId,
      step,
      onCreateStep,
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
          patchModalState({
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
          patchModalState({
            selectedApp: null,
            selectedEvent: null,
            selectedConnectionId: '',
            currentScreen: 'choose-app',
          })
        }}
      />
    )
  } else {
    return <InvalidModalScreen />
  }
}
