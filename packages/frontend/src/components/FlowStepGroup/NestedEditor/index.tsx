import { type IFlow, type IStep } from '@plumber/types'

import { Modal, ModalCloseButton, ModalContent } from '@chakra-ui/react'
import Editor from 'components/Editor'

interface NestedEditorProps {
  flow: IFlow
  steps: IStep[]
  isOpen: boolean
  onClose: () => void
}

export default function NestedEditor(props: NestedEditorProps): JSX.Element {
  const { flow, steps, isOpen, onClose } = props

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="full">
      <ModalContent bg="base.canvas.brand-subtle" pt={24}>
        <ModalCloseButton />
        <Editor flow={flow} steps={steps} />
      </ModalContent>
    </Modal>
  )
}
