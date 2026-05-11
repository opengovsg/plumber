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
      <ModalContent>
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
