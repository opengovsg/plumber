import { useCallback, useContext } from 'react'
import { useMutation } from '@apollo/client'
import { Flex, Text } from '@chakra-ui/react'
import { Button, Infobox, useToast } from '@opengovsg/design-system-react'
import { EditorSettingsContext } from 'contexts/EditorSettings'
import { UPDATE_FLOW_TRANSFER_STATUS } from 'graphql/mutations/update-flow-transfer-status'
import { GET_FLOW } from 'graphql/queries/get-flow'

export default function DisallowRequestInfobox() {
  const { flow } = useContext(EditorSettingsContext)
  // definitely will have a pending transfer
  const flowTransferId = flow.pendingTransfer?.id
  const requestedEmail = flow.pendingTransfer?.newOwner.email
  const toast = useToast()
  const [updateFlowTransferStatus] = useMutation(UPDATE_FLOW_TRANSFER_STATUS)

  const onFlowTransferStatusUpdate = useCallback(async () => {
    await updateFlowTransferStatus({
      variables: {
        input: {
          id: flowTransferId,
          status: 'cancelled',
        },
      },
      refetchQueries: [GET_FLOW],
      onCompleted: () => {
        toast({
          title:
            'Transfer has been cancelled. You can now make another request.',
          status: 'success',
          duration: 3000,
          isClosable: true,
          position: 'top',
        })
      },
    })
  }, [flowTransferId, updateFlowTransferStatus, toast])

  return (
    <Infobox>
      <Flex
        flexDir={{ base: 'column', md: 'row' }}
        gap={2}
        justifyContent="space-between"
        alignItems="center"
        flex={1}
      >
        <Text>
          <strong>{requestedEmail}</strong> has not accepted this pipe transfer
          yet. You will not be able to transfer ownership to another user until
          the request has been rejected.{' '}
        </Text>
        <Button
          onClick={onFlowTransferStatusUpdate}
          variant="clear"
          colorScheme="secondary"
        >
          Cancel
        </Button>
      </Flex>
    </Infobox>
  )
}
