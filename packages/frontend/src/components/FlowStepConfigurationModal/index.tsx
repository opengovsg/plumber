import type { IAction, IApp, IStep, ITrigger } from '@plumber/types'

import { useCallback, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useMutation } from '@apollo/client'
import { Flex, Modal, ModalContent, ModalOverlay, Text } from '@chakra-ui/react'

import { UPDATE_STEP } from '@/graphql/mutations/update-step'
import { useIfThenInitializer } from '@/helpers/toolbox'

import PrimarySpinner from '../PrimarySpinner'

import ChooseAndAddConnection from './ChooseAndAddConnection'
import ChooseAppAndEvent from './ChooseAppAndEvent'
import InvalidModalScreen from './InvalidModalScreen'

interface FlowStepConfigurationModalProps {
  onClose: () => void
  isTrigger: boolean
  isLastStep: boolean
  onCreateStep?: (
    appKey: string,
    eventKey: string,
    connectionId?: string,
  ) => Promise<IStep> // For adding of a new step
  // for updating of an existing step
  step?: IStep
  app?: IApp
  event?: ITrigger | IAction
  initialScreen?: ModalScreen
}

export type ModalScreen =
  | 'choose-app'
  | 'choose-event'
  | 'choose-connection'
  | 'add-connection'
  | 'configure-excel-connection'

export type ModalState = {
  currentScreen: ModalScreen
  selectedApp: IApp | null
  selectedEvent: ITrigger | IAction | null
  selectedConnectionId: string
  isLoading: boolean
}

export default function FlowStepConfigurationModal(
  props: FlowStepConfigurationModalProps,
): JSX.Element {
  const {
    onClose,
    isTrigger,
    isLastStep,
    onCreateStep,
    step,
    app,
    event,
    initialScreen,
  } = props
  const { flowId } = useParams()
  // Remember to always clear the selectedConnectionId when the modal is back to the first screen
  const [modalState, setModalState] = useState<ModalState>({
    currentScreen: initialScreen ?? 'choose-app',
    selectedApp: app ?? null,
    selectedEvent: event ?? null,
    selectedConnectionId: step?.connection?.id ?? '',
    isLoading: false,
  })

  const { currentScreen, isLoading } = modalState
  const [_, isInitializingIfThen] = useIfThenInitializer()

  const updateModalState = (newState: Partial<ModalState>) => {
    setModalState((prevState) => ({ ...prevState, ...newState }))
  }
  const [updateStep] = useMutation(UPDATE_STEP)

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

  const currentScreenComponent = useMemo(() => {
    // Group choose app and event together, and choose connection and add connection together
    if (currentScreen === 'choose-app' || currentScreen === 'choose-event') {
      return (
        <ChooseAppAndEvent
          onClose={onClose}
          isTrigger={isTrigger}
          isLastStep={isLastStep}
          modalState={modalState}
          updateModalState={updateModalState}
          onUpdateStep={onUpdateStep}
          onCreateStep={onCreateStep}
          step={step}
          initialScreen={initialScreen}
        />
      )
    } else if (
      currentScreen === 'choose-connection' ||
      currentScreen === 'add-connection' ||
      currentScreen === 'configure-excel-connection'
    ) {
      return (
        <ChooseAndAddConnection
          onClose={onClose}
          modalState={modalState}
          updateModalState={updateModalState}
          onUpdateStep={onUpdateStep}
          onCreateStep={onCreateStep}
          step={step}
          initialScreen={initialScreen}
        />
      )
    } else {
      return <InvalidModalScreen />
    }
  }, [
    currentScreen,
    onClose,
    isTrigger,
    isLastStep,
    modalState,
    onUpdateStep,
    onCreateStep,
    step,
    initialScreen,
  ])

  return (
    <Modal
      isCentered
      isOpen={true}
      onClose={onClose}
      closeOnOverlayClick={false}
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
            <Text>{step ? 'Updating step...' : 'Adding step...'}</Text>
          </Flex>
        ) : (
          currentScreenComponent
        )}
      </ModalContent>
    </Modal>
  )
}
