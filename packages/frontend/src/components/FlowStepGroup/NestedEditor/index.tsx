import { type IFlow, type IStep } from '@plumber/types'

import { useContext } from 'react'
import { BiChevronLeft } from 'react-icons/bi'
import {
  Flex,
  Modal,
  ModalContent,
  ModalHeader,
  ModalOverlay,
} from '@chakra-ui/react'
import { Button } from '@opengovsg/design-system-react'

import Editor from '@/components/Editor'
import { EditorContext, EditorProvider } from '@/contexts/Editor'

interface NestedEditorProps {
  flow: IFlow
  steps: IStep[]
  isOpen: boolean
  onClose: () => void
}

export default function NestedEditor(props: NestedEditorProps): JSX.Element {
  const { flow, steps, isOpen, onClose } = props

  const { flowId, readOnly } = useContext(EditorContext)

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="6xl"
      closeOnEsc={false}
      closeOnOverlayClick={false}
      motionPreset="none"
      isCentered
    >
      <ModalOverlay />
      <ModalContent
        bg="base.canvas.brand-subtle"
        m={{ base: 0, lg: 16 }}
        borderRadius="lg"
        height="calc(100vh - 8rem)"
      >
        <ModalHeader display="flex" justifyContent="center">
          <Button
            left={4}
            top={4}
            position="absolute"
            variant="clear"
            colorScheme="secondary"
            pl={0}
            outline="none"
            onClick={onClose}
            leftIcon={<BiChevronLeft size={28} />}
          >
            Back to pipe
          </Button>
        </ModalHeader>
        <Flex p={8} overflowY="auto">
          <Editor flow={flow} steps={steps} isNested={true} />
        </Flex>
      </ModalContent>
    </Modal>
  )
}
