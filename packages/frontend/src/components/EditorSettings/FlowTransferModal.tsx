import { useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation } from '@apollo/client'
import {
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Text,
} from '@chakra-ui/react'
import { Button, useToast } from '@opengovsg/design-system-react'
import { CREATE_FLOW_TRANSFER } from 'graphql/mutations/create-flow-transfer'

import * as URLS from '../../config/urls'

interface FlowTransferModalProps {
  onClose: () => void
  flowId?: string
  newOwnerEmail: string
}

export default function FlowTransferModal(props: FlowTransferModalProps) {
  const { onClose, flowId, newOwnerEmail } = props

  const [createFlowTransfer] = useMutation(CREATE_FLOW_TRANSFER)
  const toast = useToast()
  const navigate = useNavigate()

  const onFlowTransferCreate = useCallback(async () => {
    onClose()
    await createFlowTransfer({
      variables: {
        input: {
          flowId,
          newOwnerEmail,
        },
      },

      onCompleted: () => {
        navigate(URLS.FLOWS)
        toast({
          title:
            'Transfer has been initiated. Please get the new owner to login and approve!',
          status: 'success',
          duration: 5000,
          isClosable: true,
          position: 'top',
        })
      },
    })
  }, [onClose, flowId, newOwnerEmail, createFlowTransfer, navigate, toast])

  return (
    <Modal isOpen={true} onClose={onClose}>
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>Transfer pipe ownership</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <Text>
            You are transferring this pipe to <strong>{newOwnerEmail}</strong>.
            For the pipe to be successfully transferred, the new pipe owner has
            to log in to Plumber to accept the transfer.
          </Text>
        </ModalBody>

        {/* CTA to transfer pipe */}
        <ModalFooter>
          <Button
            onClick={onClose}
            mr={4}
            variant="clear"
            colorScheme="secondary"
          >
            Cancel
          </Button>
          <Button onClick={onFlowTransferCreate}>Yes, transfer pipe</Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}
