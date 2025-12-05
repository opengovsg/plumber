import { Modal, ModalContent, ModalOverlay } from '@chakra-ui/react'

import { AiFormData } from '../../schema'
import { AIFormModalContent } from '../AIFormModalContent'

const ModifyPromptModal = ({
  isOpen,
  formInput,
  onClose,
  onUpdatePrompt,
}: {
  isOpen: boolean
  formInput: {
    trigger: string
    actions: string
  }
  onClose: () => void
  onUpdatePrompt: (formData: AiFormData) => Promise<void>
}) => {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      motionPreset="none"
      closeOnEsc={false}
      isCentered
    >
      <ModalOverlay bg="base.canvas.overlay" />

      <ModalContent>
        <AIFormModalContent
          trigger={formInput?.trigger || ''}
          actions={formInput?.actions || ''}
          type="update"
          onBack={onClose}
          onSubmit={onUpdatePrompt}
        />
      </ModalContent>
    </Modal>
  )
}

export default ModifyPromptModal
