import { type IFlow, type IStep } from '@plumber/types'

import { BiChevronLeft } from 'react-icons/bi'
import {
  Box,
  Modal,
  ModalContent,
  ModalHeader,
  ModalOverlay,
} from '@chakra-ui/react'
import { Button } from '@opengovsg/design-system-react'

import Editor from '@/components/Editor'

interface NestedEditorProps {
  flow: IFlow
  steps: IStep[]
  isOpen: boolean
  onClose: () => void
}

export default function NestedEditor(props: NestedEditorProps): JSX.Element {
  const { flow, steps, isOpen, onClose } = props

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="6xl"
      closeOnEsc={false}
      motionPreset="none"
    >
      <ModalOverlay />
      <ModalContent
        bg="base.canvas.brand-subtle"
        mt={{ base: 0, lg: 16 }}
        borderRadius="lg"
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
        <Box p={8}>
          <Editor flow={flow} steps={steps} />
        </Box>
      </ModalContent>
    </Modal>
  )
}
