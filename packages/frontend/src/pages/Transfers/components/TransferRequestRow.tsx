import { IFlowTransfer } from '@plumber/types'

import { useCallback, useState } from 'react'
import { type IconType } from 'react-icons'
import { BiCheck, BiX } from 'react-icons/bi'
import { useMutation } from '@apollo/client'
import { Box, Divider, Flex, Icon, Text } from '@chakra-ui/react'
import { IconButton, useToast } from '@opengovsg/design-system-react'

import client from '@/graphql/client'
import { UPDATE_FLOW_TRANSFER_STATUS } from '@/graphql/mutations/update-flow-transfer-status'
import { GET_PENDING_FLOW_TRANSFERS } from '@/graphql/queries/get-pending-flow-transfers'

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
  loading: boolean
}

function ActionButton(props: ActionButtonProps) {
  const { ariaLabel, icon, onUpdateRequest, loading } = props
  return (
    <IconButton
      aria-label={ariaLabel}
      icon={<Icon as={icon} boxSize={6} />}
      variant="clear"
      colorScheme="secondary"
      onClick={onUpdateRequest}
      isLoading={loading}
    />
  )
}

export default function TransferRequestRow(props: TransferRequestRowProps) {
  const { flowTransfer, isOpen, onOpen, onClose } = props
  const flowTransferId = flowTransfer.id
  const [isFlowTransferApproved, setIsFlowTransferApproved] =
    useState<boolean>(false)

  const toast = useToast()
  const [updateFlowTransferStatus, { loading }] = useMutation(
    UPDATE_FLOW_TRANSFER_STATUS,
  )

  const onApproveClose = useCallback(async () => {
    onClose()
    await client.refetchQueries({ include: [GET_PENDING_FLOW_TRANSFERS] }) // only refetch after the modal is closed
  }, [onClose])

  // Approve mutation: transfer pipe and nullify connections (phase 1)
  const onFlowTransferStatusApprove = useCallback(async () => {
    await updateFlowTransferStatus({
      variables: {
        input: {
          id: flowTransferId,
          status: 'approved',
        },
      },
      onCompleted: () => {
        onOpen()
        setIsFlowTransferApproved((value) => !value)
      },
    })
  }, [flowTransferId, updateFlowTransferStatus, onOpen])

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
              {flowTransfer.oldOwner.email} is transferring you
            </Text>
            <Text textStyle="subhead-1">{flowTransfer.flow.name}</Text>
          </Flex>
          <ActionButton
            ariaLabel="approve-request"
            icon={BiCheck}
            onUpdateRequest={onFlowTransferStatusApprove}
            loading={loading}
          />
          <ActionButton
            ariaLabel="reject-request"
            icon={BiX}
            onUpdateRequest={onFlowTransferStatusReject}
            loading={loading}
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
