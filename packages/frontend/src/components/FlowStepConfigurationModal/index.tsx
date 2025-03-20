import type { IAction, IApp, IStep, ITrigger } from '@plumber/types'

import { useCallback, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useMutation } from '@apollo/client'
import { Modal, ModalContent, ModalOverlay } from '@chakra-ui/react'

import { UPDATE_STEP } from '@/graphql/mutations/update-step'

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
}

export type ModalScreen =
  | 'choose-app'
  | 'choose-event'
  | 'choose-connection'
  | 'add-connection'

export type ModalState = {
  currentScreen: ModalScreen
  selectedApp: IApp | null
  selectedEvent: ITrigger | IAction | null
  selectedConnectionId: string
}

export default function FlowStepConfigurationModal(
  props: FlowStepConfigurationModalProps,
): JSX.Element {
  const { onClose, isTrigger, isLastStep, onCreateStep, step, app, event } =
    props
  const { flowId } = useParams()
  // Remember to always clear the selectedConnectionId when the modal is back to the first screen
  const [modalState, setModalState] = useState<ModalState>({
    currentScreen: 'choose-app',
    selectedApp: app ?? null,
    selectedEvent: event ?? null,
    selectedConnectionId: step?.connection?.id ?? '',
  })

  const { currentScreen } = modalState

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
        />
      )
    } else if (
      currentScreen === 'choose-connection' ||
      currentScreen === 'add-connection'
    ) {
      return (
        <ChooseAndAddConnection
          onClose={onClose}
          modalState={modalState}
          updateModalState={updateModalState}
          onUpdateStep={onUpdateStep}
          onCreateStep={onCreateStep}
          step={step}
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
        {currentScreenComponent}
      </ModalContent>
    </Modal>
  )
}
