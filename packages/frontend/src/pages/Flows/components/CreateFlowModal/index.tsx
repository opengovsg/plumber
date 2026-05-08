import { FormEvent } from 'react'
import {
  Modal,
  ModalCloseButton,
  ModalContent,
  ModalOverlay,
} from '@chakra-ui/react'

import { useFlowCreation } from '@/pages/Flows/hooks/useFlowCreation'

import FlowNameAndModeContent from './FlowNameAndModeContent'

interface CreateFlowModalProps {
  onClose: () => void
}

export default function CreateFlowModal(props: CreateFlowModalProps) {
  const { onClose } = props

  const {
    flowName,
    inputRef,
    handleInputChange,
    isButtonDisabled,
    handleModeSubmit,
    loading,
  } = useFlowCreation()

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    handleModeSubmit({ onClose })
  }

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      motionPreset="none"
      closeOnEsc={false}
    >
      <ModalOverlay bg="base.canvas.overlay" />
      <ModalContent
        sx={{
          // The theme applies `margin: auto` which re-centers the modal
          // vertically on every height change (e.g. when the flow name input
          // appears), causing the top to jump. Overriding with a fixed top
          // margin pins the top edge so the modal only grows downward.
          // CSS media query is used instead of useIsMobile to avoid a
          // JS-driven re-render that would cause the same shift on open.
          '@media (min-width: 48em)': {
            margin: 'clamp(2rem, 15vh, 8rem) auto 0 !important',
          },
        }}
      >
        <FlowNameAndModeContent
          isButtonDisabled={isButtonDisabled}
          loading={loading}
          inputRef={inputRef}
          flowName={flowName}
          handleInputChange={handleInputChange}
          handleSubmit={handleSubmit}
        />
        <ModalCloseButton mt={3} />
      </ModalContent>
    </Modal>
  )
}
