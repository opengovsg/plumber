import type { IAction, IApp, IStep, ITrigger } from '@plumber/types'

import { useContext } from 'react'
import { Flex, Modal, ModalContent, ModalOverlay, Text } from '@chakra-ui/react'

import { useIfThenInitializer } from '@/helpers/toolbox'

import PrimarySpinner from '../PrimarySpinner'

import ChooseAndAddConnection from './ChooseAndAddConnection'
import ChooseAppAndEvent from './ChooseAppAndEvent'
import {
  FlowStepConfigurationContext,
  FlowStepConfigurationContextProvider,
} from './FlowStepConfigurationContext'
import InvalidModalScreen from './InvalidModalScreen'

interface FlowStepConfigurationModalProps {
  onClose: () => void
  isTrigger: boolean
  isLastStep: boolean
  // for updating of an existing step
  step?: IStep
  app?: IApp
  event?: ITrigger | IAction
  prevStepId?: string
}

function FlowStepConfigurationModalContent({
  onClose,
}: {
  onClose: () => void
}): JSX.Element {
  const { modalState, step } = useContext(FlowStepConfigurationContext)
  const { currentScreen, isLoading } = modalState
  const [_, isInitializingIfThen] = useIfThenInitializer()

  if (isLoading || isInitializingIfThen) {
    return (
      <Flex flexDir="column" alignItems="center" gap={6} my={12}>
        <PrimarySpinner margin="auto" fontSize="4xl" />
        <Text>{step ? 'Updating step...' : 'Adding step...'}</Text>
      </Flex>
    )
  }
  if (currentScreen === 'choose-app' || currentScreen === 'choose-event') {
    return <ChooseAppAndEvent onClose={onClose} />
  }
  if (
    currentScreen === 'choose-connection' ||
    currentScreen === 'add-connection'
  ) {
    return <ChooseAndAddConnection onClose={onClose} />
  }
  return <InvalidModalScreen />
}

/**
 * This modal appears in two scenarios
 * 1. Adding a new step
 * 2. Editing the initial trigger or action of an empty flow
 */
export default function FlowStepConfigurationModal(
  props: FlowStepConfigurationModalProps,
): JSX.Element {
  const { onClose, isTrigger, isLastStep, step, app, event, prevStepId } = props

  return (
    <FlowStepConfigurationContextProvider
      isTrigger={isTrigger}
      isLastStep={isLastStep}
      app={app}
      event={event}
      prevStepId={prevStepId}
      step={step}
    >
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
          <FlowStepConfigurationModalContent onClose={onClose} />
        </ModalContent>
      </Modal>
    </FlowStepConfigurationContextProvider>
  )
}
