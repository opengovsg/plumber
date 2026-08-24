import { Modal, ModalContent, ModalOverlay } from '@chakra-ui/react'
import type { IAction, IApp, IStep, ITrigger } from '@plumber/types'
import { useContext } from 'react'

import type { AnchorPlacement } from './helpers/anchor-placement'
import ChooseAndAddConnection from './ChooseAndAddConnection'
import ChooseAppAndEvent from './ChooseAppAndEvent'
import {
  FlowStepConfigurationContext,
  FlowStepConfigurationContextProvider,
} from './FlowStepConfigurationContext'
import InvalidModalScreen from './InvalidModalScreen'
import LoadingOverlay from './LoadingOverlay'

interface FlowStepConfigurationModalProps {
  onClose: () => void
  isTrigger: boolean
  isLastStep: boolean
  // for updating of an existing step
  step?: IStep
  app?: IApp
  event?: ITrigger | IAction
  prevStep?: IStep
  // Set only when launched from an if-then block's add-after affordance.
  previousBlockId?: string
  // Set only by launchers whose anchor step misrepresents where their new step
  // lands relative to an if-then block. See AnchorPlacement.
  anchorPlacement?: AnchorPlacement
}

function FlowStepConfigurationModalContent({
  onClose,
}: {
  onClose: () => void
}): JSX.Element {
  const { modalState } = useContext(FlowStepConfigurationContext)
  const { currentScreen } = modalState

  if (currentScreen === 'choose-app' || currentScreen === 'choose-event') {
    return <ChooseAppAndEvent onClose={onClose} />
  }
  if (
    currentScreen === 'choose-connection' ||
    currentScreen === 'add-connection' ||
    currentScreen === 'configure-excel-connection' ||
    currentScreen === 'configure-databricks-connection'
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
  const {
    onClose,
    isTrigger,
    isLastStep,
    step,
    app,
    event,
    prevStep,
    previousBlockId,
    anchorPlacement,
  } = props

  return (
    <FlowStepConfigurationContextProvider
      isTrigger={isTrigger}
      isLastStep={isLastStep}
      app={app}
      event={event}
      prevStep={prevStep}
      previousBlockId={previousBlockId}
      anchorPlacement={anchorPlacement}
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
          py={8}
          position="relative"
        >
          <FlowStepConfigurationModalContent onClose={onClose} />
          <LoadingOverlay />
        </ModalContent>
      </Modal>
    </FlowStepConfigurationContextProvider>
  )
}
