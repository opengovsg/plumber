import type { IAction, IApp, IStep, ITrigger } from '@plumber/types'

import { useCallback, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useMutation, useQuery } from '@apollo/client'
import { Flex, Modal, ModalContent, ModalOverlay, Text } from '@chakra-ui/react'

import { UPDATE_STEP } from '@/graphql/mutations/update-step'
import { GET_APPS } from '@/graphql/queries/get-apps'
import {
  TOOLBOX_ACTIONS,
  TOOLBOX_APP_KEY,
  useIfThenInitializer,
} from '@/helpers/toolbox'

import PrimarySpinner from '../PrimarySpinner'

import ChooseApp from './ChooseApp'
import ChooseEvent from './ChooseEvent'

interface FlowStepConfigurationModalProps {
  onClose: () => void
  isTrigger: boolean
  isLastStep: boolean
  onCreateStep?: (appKey: string, eventKey: string) => Promise<IStep> // For adding of a new step
  step?: IStep // for updating of an existing step
}

export type ModalScreen = 'choose-app' | 'choose-event' | 'choose-connection'

export default function FlowStepConfigurationModal(
  props: FlowStepConfigurationModalProps,
): JSX.Element {
  const { onClose, isLastStep, isTrigger, onCreateStep, step } = props
  const { flowId } = useParams()
  const [currentScreen, setCurrentScreen] = useState<ModalScreen>('choose-app')
  const [selectedApp, setSelectedApp] = useState<IApp | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const { data } = useQuery(GET_APPS)
  const apps: IApp[] = data?.getApps?.filter((app: IApp) =>
    isTrigger ? !!app.triggers?.length : !!app.actions?.length,
  )

  const [updateStep] = useMutation(UPDATE_STEP)
  const [initializeIfThen, isInitializingIfThen] = useIfThenInitializer()

  const onUpdateStep = useCallback(
    async (step: IStep) => {
      const mutationInput: Record<string, unknown> = {
        id: step.id,
        key: step.key,
        parameters: step.parameters,
        connection: {
          id: step.connection?.id,
        },
        flow: {
          id: flowId,
        },
      }

      if (step.appKey) {
        mutationInput.appKey = step.appKey
      }

      const { data } = await updateStep({
        variables: { input: mutationInput },
      })
      return data?.updateStep as IStep
    },
    [updateStep, flowId],
  )

  const onSelectAppEvent = useCallback(
    async (app: IApp, triggerOrAction: ITrigger | IAction) => {
      if (app.auth) {
        setSelectedApp(app)
        setCurrentScreen('choose-connection')
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
    [onClose, onCreateStep, onUpdateStep, initializeIfThen, step],
  )

  // Will consist both modal header and body
  const currentScreenComponent = useMemo(() => {
    switch (currentScreen) {
      case 'choose-app':
        return (
          <ChooseApp
            apps={apps}
            isTrigger={isTrigger}
            onSelectApp={(app: IApp) => {
              setSelectedApp(app)
              setCurrentScreen('choose-event')
            }}
            onSelectAppEvent={onSelectAppEvent}
          />
        )
      case 'choose-event':
        return (
          selectedApp && (
            <ChooseEvent
              selectedApp={selectedApp}
              isTrigger={isTrigger}
              isLastStep={isLastStep}
              onSelectAppEvent={onSelectAppEvent}
              onBack={() => {
                setSelectedApp(null)
                setCurrentScreen('choose-app')
              }}
            />
          )
        )
      case 'choose-connection':
        return selectedApp && <h1>Choose Connection Screen</h1>
    }
  }, [
    currentScreen,
    apps,
    isTrigger,
    onSelectAppEvent,
    selectedApp,
    isLastStep,
  ])

  return (
    <Modal
      isCentered
      isOpen={true}
      onClose={onClose}
      size="xl"
      scrollBehavior="inside"
      autoFocus={false}
    >
      <ModalOverlay bg="base.canvas.overlay" />
      <ModalContent
        maxW="600px"
        maxH="90vh"
        h="auto"
        overflow="hidden"
        borderRadius="lg"
      >
        {isLoading || isInitializingIfThen ? (
          <Flex flexDir="column" alignItems="center" gap={6} my={12}>
            <PrimarySpinner margin="auto" fontSize="4xl" />
            <Text>Adding step...</Text>
          </Flex>
        ) : (
          currentScreenComponent
        )}
      </ModalContent>
    </Modal>
  )
}
