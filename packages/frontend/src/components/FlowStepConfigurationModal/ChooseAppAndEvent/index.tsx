import { type IAction, IApp, IStep, ITrigger } from '@plumber/types'

import { useCallback, useState } from 'react'
import { useQuery } from '@apollo/client'
import { Flex, Text } from '@chakra-ui/react'

import PrimarySpinner from '@/components/PrimarySpinner'
import { GET_APPS } from '@/graphql/queries/get-apps'
import {
  TOOLBOX_ACTIONS,
  TOOLBOX_APP_KEY,
  useIfThenInitializer,
} from '@/helpers/toolbox'

import { APP_ALLOWING_EMPTY_CONNECTION } from '../constants'
import InvalidModalScreen from '../InvalidModalScreen'
import { type ModalState } from '..'

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
  } = props
  const { currentScreen, selectedApp } = modalState

  const { data } = useQuery(GET_APPS)
  const apps: IApp[] = data?.getApps?.filter((app: IApp) =>
    isTrigger ? !!app.triggers?.length : !!app.actions?.length,
  )

  const [isLoading, setIsLoading] = useState(false)
  const [initializeIfThen, isInitializingIfThen] = useIfThenInitializer()
  const onSelectAppEvent = useCallback(
    async (app: IApp, triggerOrAction: ITrigger | IAction) => {
      if (app.auth && app.key !== APP_ALLOWING_EMPTY_CONNECTION) {
        updateModalState({
          selectedApp: app,
          selectedEvent: triggerOrAction,
          currentScreen: 'choose-connection',
        })
        return
      }
      // If the app has no connections, create or update a new step and close the modal
      setIsLoading(true)
      if (onCreateStep) {
        await onCreateStep(app.key, triggerOrAction.key)
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
            parameters: {},
          })
        }
      }
      setIsLoading(false)
      onClose()
    },
    [
      onClose,
      onCreateStep,
      onUpdateStep,
      initializeIfThen,
      step,
      updateModalState,
    ],
  )

  if (isLoading || isInitializingIfThen) {
    return (
      <Flex flexDir="column" alignItems="center" gap={6} my={12}>
        <PrimarySpinner margin="auto" fontSize="4xl" />
        <Text>Adding step...</Text>
      </Flex>
    )
  }

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
            currentScreen: 'choose-app',
          })
        }}
      />
    )
  } else {
    return <InvalidModalScreen />
  }
}
