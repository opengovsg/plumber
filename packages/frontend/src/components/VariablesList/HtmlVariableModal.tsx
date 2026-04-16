import {
  Flex,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalHeader,
  ModalOverlay,
} from '@chakra-ui/react'

import { Variable } from '@/helpers/variables'

import RichTextEditor from '../RichTextEditor'

interface VariableHtmlModalProps {
  isOpen: boolean
  onClose: () => void
  variable: Variable
}

export default function VariableHtmlModal({
  isOpen,
  onClose,
  variable,
}: VariableHtmlModalProps) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="6xl"
      motionPreset="none"
      isCentered
    >
      <ModalOverlay />
      <ModalContent maxH="80vh" overflow="hidden" borderRadius="lg">
        <ModalHeader
          position="sticky"
          top={0}
          bg="white"
          zIndex={1}
          borderBottom="1px solid"
          borderColor="base.divider.medium"
        >
          <Flex direction="column">Email body</Flex>
          <ModalCloseButton />
        </ModalHeader>
        <ModalBody>
          <RichTextEditor
            name={variable.name}
            defaultValue={variable.value as string}
            isRich
            variablesEnabled={false}
            isDisplayOnly={true}
          />
        </ModalBody>
      </ModalContent>
    </Modal>
  )
}
