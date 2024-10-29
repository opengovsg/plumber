import { BiShareAlt } from 'react-icons/bi'
import {
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  useDisclosure,
} from '@chakra-ui/react'
import { Button, ButtonProps } from '@opengovsg/design-system-react'

import ShareLink from './ShareLink'
import {
  ShareModalContextProvider,
  useShareModalContext,
} from './ShareModalContext'
import TableCollaborators from './TableCollaborators'
import TransferOwnership from './TransferOwnership'

const ShareModal = () => {
  const { onClose, emailToTransfer } = useShareModalContext()

  return (
    <Modal isOpen={true} onClose={onClose} motionPreset="none" isCentered>
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>Share tile</ModalHeader>
        <ModalCloseButton />
        <ModalBody pt={2}>
          {emailToTransfer ? (
            <TransferOwnership />
          ) : (
            <>
              <ShareLink />
              <TableCollaborators />
            </>
          )}
        </ModalBody>
        <ModalFooter></ModalFooter>
      </ModalContent>
    </Modal>
  )
}

const ShareButton = (props: ButtonProps) => {
  const { isOpen, onOpen, onClose } = useDisclosure()

  return (
    <ShareModalContextProvider onClose={onClose}>
      <Button
        variant="clear"
        colorScheme="secondary"
        size="xs"
        onClick={onOpen}
        leftIcon={<BiShareAlt />}
        {...props}
      >
        Share
      </Button>
      {/* unmount component when closed to reset all state */}
      {isOpen && <ShareModal />}
    </ShareModalContextProvider>
  )
}

export default ShareButton
