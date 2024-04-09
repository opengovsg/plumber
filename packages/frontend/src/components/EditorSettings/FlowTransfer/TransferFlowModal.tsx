import { useCallback, useContext } from 'react'
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
import { EditorSettingsContext } from 'contexts/EditorSettings'
import { CREATE_FLOW_TRANSFER } from 'graphql/mutations/create-flow-transfer'
import { GET_FLOW } from 'graphql/queries/get-flow'

interface TransferFlowModalProps {
  onClose: () => void
  newOwnerEmail: string
}

export default function TransferFlowModal(props: TransferFlowModalProps) {
  const { onClose, newOwnerEmail } = props
  const { flow } = useContext(EditorSettingsContext)

  const [createFlowTransfer] = useMutation(CREATE_FLOW_TRANSFER)
  const toast = useToast()

  const onFlowTransferCreate = useCallback(async () => {
    await createFlowTransfer({
      variables: {
        input: {
          flowId: flow.id,
          newOwnerEmail,
        },
      },
      refetchQueries: [GET_FLOW],
      onError: () => {
        onClose()
      },
      onCompleted: () => {
        onClose()
        toast({
          title:
            'Transfer has been requested. Please get the new owner to login and approve.',
          status: 'success',
          duration: 5000,
          isClosable: true,
          position: 'top',
        })
      },
    })
  }, [onClose, flow.id, newOwnerEmail, createFlowTransfer, toast])

  return (
    <Modal isOpen={true} onClose={onClose}>
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>Transfer pipe ownership</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <Text>
            You are transferring this pipe to {newOwnerEmail}. For the pipe to
            be successfully transferred, the new pipe owner has to log in to
            Plumber to accept the transfer.
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
