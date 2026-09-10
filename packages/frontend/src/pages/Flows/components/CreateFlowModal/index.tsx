import {
  Modal,
  ModalCloseButton,
  ModalContent,
  ModalOverlay,
} from '@chakra-ui/react'
import { FormEvent } from 'react'

import { FLOW_CREATE_MODE } from '@/pages/Flows/contexts/CreateFlowContext'
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

  const handleModeSelect = (mode: FLOW_CREATE_MODE) => {
    handleModeSubmit({ onClose, mode })
  }

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      motionPreset="none"
      closeOnEsc={false}
      isCentered
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
          onModeSelect={handleModeSelect}
        />
        <ModalCloseButton mt={3} />
      </ModalContent>
    </Modal>
  )
}
