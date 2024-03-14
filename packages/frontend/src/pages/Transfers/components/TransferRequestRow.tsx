import { IFlowTransfer } from '@plumber/types'

import { useCallback, useState } from 'react'
import { type IconType } from 'react-icons'
import { BiCheck, BiX } from 'react-icons/bi'
import { useMutation } from '@apollo/client'
import { Box, Divider, Flex, Icon, Text } from '@chakra-ui/react'
import { IconButton, useToast } from '@opengovsg/design-system-react'
import client from 'graphql/client'
import { UPDATE_FLOW_OWNER } from 'graphql/mutations/update-flow-owner'
import { UPDATE_FLOW_TRANSFER_STATUS } from 'graphql/mutations/update-flow-transfer-status'
import { GET_PENDING_FLOW_TRANSFERS } from 'graphql/queries/get-pending-flow-transfers'

import ViewFlowModal from './ViewFlowModal'

interface TransferRequestRowProps {
  flowTransfer: IFlowTransfer
  isOpen: boolean
  onOpen: () => void
  onClose: () => void
}

interface ActionButtonProps {
  ariaLabel: string
  icon: IconType
  onUpdateRequest: () => void
}

function ActionButton(props: ActionButtonProps) {
  const { ariaLabel, icon, onUpdateRequest } = props
  return (
    <IconButton
      aria-label={ariaLabel}
      icon={<Icon as={icon} boxSize={6} />}
      variant="clear"
      colorScheme="secondary"
      onClick={onUpdateRequest}
    />
  )
}

export default function TransferRequestRow(props: TransferRequestRowProps) {
  const { flowTransfer, isOpen, onOpen, onClose } = props
  const flowTransferId = flowTransfer.id
  const [isFlowTransferApproved, setIsFlowTransferApproved] =
    useState<boolean>(false)

  const toast = useToast()
  const [updateFlowTransferStatus] = useMutation(UPDATE_FLOW_TRANSFER_STATUS)
  const [updateFlowOwner] = useMutation(UPDATE_FLOW_OWNER)

  const onApproveClose = useCallback(async () => {
    onClose()
    await client.refetchQueries({ include: [GET_PENDING_FLOW_TRANSFERS] }) // only refetch after the modal is clossed
  }, [onClose])

  // Approve mutations
  const onFlowOwnerUpdate = useCallback(async () => {
    await updateFlowOwner({
      variables: {
        input: {
          id: flowTransfer.flowId,
        },
      },
      onCompleted: () => {
        onOpen()
        setIsFlowTransferApproved((value) => !value)
        toast({
          title:
            'Pipe has been transferred to your account. You will need to manually add the connections to your pipe for it to work.',
          status: 'success',
          duration: 3000,
          isClosable: true,
          position: 'top',
          // TODO (mal): fix this because idk how to put the toast on top of the overlay
          containerStyle: {
            zIndex: 9000,
          },
        })
      },
    })
  }, [flowTransfer.flowId, updateFlowOwner, onOpen, toast])

  const onFlowTransferStatusApprove = useCallback(async () => {
    await updateFlowTransferStatus({
      variables: {
        input: {
          id: flowTransferId,
          status: 'approved',
        },
      },
      onCompleted: async () => {
        // phase 1: calls the transfer of pipe without duplicating connections
        await onFlowOwnerUpdate()
      },
    })
  }, [flowTransferId, updateFlowTransferStatus, onFlowOwnerUpdate])

  // Reject mutation
  const onFlowTransferStatusReject = useCallback(async () => {
    await updateFlowTransferStatus({
      variables: {
        input: {
          id: flowTransferId,
          status: 'rejected',
        },
      },
      refetchQueries: [GET_PENDING_FLOW_TRANSFERS],
      onCompleted: () => {
        toast({
          title: 'Transfer has been rejected.',
          status: 'success',
          duration: 3000,
          isClosable: true,
          position: 'top',
        })
      },
    })
  }, [flowTransferId, updateFlowTransferStatus, toast])

  return (
    <>
      <Box>
        <Flex py={6} px={8} alignItems="center" gap={8}>
          <Flex flexDir="column" gap={2} flex={1}>
            <Text textStyle="body-1">
              {flowTransfer.oldOwner?.email} is transferring you
            </Text>
            <Text textStyle="subhead-1">{flowTransfer.flow?.name}</Text>
          </Flex>
          <ActionButton
            ariaLabel="approve-request"
            icon={BiCheck}
            onUpdateRequest={onFlowTransferStatusApprove}
          />
          <ActionButton
            ariaLabel="reject-request"
            icon={BiX}
            onUpdateRequest={onFlowTransferStatusReject}
          />
        </Flex>
        <Divider borderColor="base.divider.medium" />
      </Box>
      {/* ONLY render modal if the transfer request is approved */}
      {isOpen && isFlowTransferApproved && (
        <ViewFlowModal onClose={onApproveClose} flowId={flowTransfer.flowId} />
      )}
    </>
  )
}
