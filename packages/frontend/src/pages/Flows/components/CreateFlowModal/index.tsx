import {
  Modal,
  ModalCloseButton,
  ModalContent,
  ModalOverlay,
} from '@chakra-ui/react'
import { FormEvent, useState } from 'react'

import {
  FLOW_CREATE_MODE,
  useCreateFlowContext,
} from '@/pages/Flows/contexts/CreateFlowContext'
import { useFlowCreation } from '@/pages/Flows/hooks/useFlowCreation'
import { TEMPLATE_MODAL_HEIGHT } from '@/pages/Template/constants'

import CreateFromTemplate from './CreateFromTemplate'
import FlowNameAndModeContent from './FlowNameAndModeContent'

interface CreateFlowModalProps {
  onClose: () => void
}

export default function CreateFlowModal(props: CreateFlowModalProps) {
  const { onClose } = props

  const { setCreateMode } = useCreateFlowContext()
  const [isChoosingTemplate, setIsChoosingTemplate] = useState(false)
  // IMPORTANT: closing mid-creation lets a reopened modal start a second
  // pipe, and the first request would then close it and redirect.
  const [isCreatingFromTemplate, setIsCreatingFromTemplate] = useState(false)

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
    // Templates stay inside this modal so the user does not lose their place.
    if (mode === 'template') {
      setIsChoosingTemplate(true)
      return
    }
    handleModeSubmit({ onClose, mode })
  }

  const handleBackToModes = () => {
    setCreateMode(null)
    setIsChoosingTemplate(false)
  }

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      motionPreset="none"
      closeOnEsc={false}
      closeOnOverlayClick={!isCreatingFromTemplate}
      isCentered
      size="4xl"
    >
      <ModalOverlay bg="base.canvas.overlay" />
      <ModalContent
        {...(isChoosingTemplate && {
          h: TEMPLATE_MODAL_HEIGHT,
          maxH: 'calc(100vh - 4rem)',
        })}
      >
        {isChoosingTemplate ? (
          <CreateFromTemplate
            onBack={handleBackToModes}
            onDismiss={onClose}
            onBusyChange={setIsCreatingFromTemplate}
          />
        ) : (
          <>
            <FlowNameAndModeContent
              isButtonDisabled={isButtonDisabled}
              loading={loading}
              inputRef={inputRef}
              flowName={flowName}
              handleInputChange={handleInputChange}
              handleSubmit={handleSubmit}
              onModeSelect={handleModeSelect}
            />
            <ModalCloseButton top="1.625rem" right={4} />
          </>
        )}
      </ModalContent>
    </Modal>
  )
}
