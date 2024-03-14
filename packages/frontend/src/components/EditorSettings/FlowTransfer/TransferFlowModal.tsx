import { useCallback } from 'react'
import { useParams } from 'react-router-dom'
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
import { GET_PENDING_FLOW_TRANSFER } from 'graphql/queries/get-pending-flow-transfer'

interface TransferFlowModalProps {
  onClose: () => void
  newOwnerEmail: string
}

export default function TransferFlowModal(props: TransferFlowModalProps) {
  const { onClose, newOwnerEmail } = props
  const { flowId } = useParams()

  const [createFlowTransfer] = useMutation(CREATE_FLOW_TRANSFER)
  const toast = useToast()

  const onFlowTransferCreate = useCallback(async () => {
    onClose()
    await createFlowTransfer({
      variables: {
        input: {
          flowId,
          newOwnerEmail,
        },
      },
      refetchQueries: [GET_PENDING_FLOW_TRANSFER],
      onCompleted: () => {
        toast({
          title:
            'Transfer has been requested. Please get the new owner to login and approve!',
          status: 'success',
          duration: 5000,
          isClosable: true,
          position: 'top',
        })
      },
    })
  }, [onClose, flowId, newOwnerEmail, createFlowTransfer, toast])

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
