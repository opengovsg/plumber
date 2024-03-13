import { IFlow } from '@plumber/types'

import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery } from '@apollo/client'
import { Center, Flex, Text, useDisclosure } from '@chakra-ui/react'
import { Button, Input, Spinner } from '@opengovsg/design-system-react'
import { GET_FLOW } from 'graphql/queries/get-flow'
import { GET_PENDING_FLOW_TRANSFER } from 'graphql/queries/get-pending-flow-transfer'

import DisallowRequestInfobox from './FlowTransfer/DisallowRequestInfobox'
import FlowTransferConnections from './FlowTransfer/FlowTransferConnections'
import PublishedFlowInfobox from './FlowTransfer/PublishedFlowInfobox'
import TransferFlowModal from './FlowTransfer/TransferFlowModal'

export function CustomSpinner() {
  return (
    <Center>
      <Spinner color="primary.600" margin="auto" fontSize="4xl" />
    </Center>
  )
}

export default function FlowTransfer() {
  const { isOpen, onOpen, onClose } = useDisclosure()

  const { flowId } = useParams()
  const [newOwnerEmail, setNewOwnerEmail] = useState<string>('')
  const { data, loading } = useQuery(GET_FLOW, { variables: { id: flowId } })
  const flow: IFlow = data?.getFlow

  const { data: flowTransferData, loading: flowTransferLoading } = useQuery(
    GET_PENDING_FLOW_TRANSFER,
    {
      variables: { flowId },
    },
  )
  const flowTransfer = flowTransferData?.getPendingFlowTransfer
  const requestedEmail = flowTransfer?.newOwner.email ?? ''

  // boolean values to indicate whether infoboxes and button can be enabled
  const shouldDisableInput = flow?.active || requestedEmail !== ''
  const shouldDisableTransfer = shouldDisableInput || newOwnerEmail === ''

  return (
    <Flex
      py={{ base: '2rem', md: '3rem' }}
      px={{ base: '1.5rem', md: '5rem' }}
      flexDir="column"
      gap={10}
      maxW={{ base: '100%', xl: '60vw' }}
      flex={1}
    >
      <Text textStyle="h3-semibold">Transfer Pipe</Text>

      {/* TODO: React suspense should fix all the loading */}
      {loading ? (
        <CustomSpinner />
      ) : (
        flow?.active && <PublishedFlowInfobox isActive={flow.active} />
      )}

      {flowTransferLoading ? (
        <CustomSpinner />
      ) : (
        !!requestedEmail && (
          <DisallowRequestInfobox
            flowTransferId={flowTransfer.id}
            requestedEmail={flowTransfer.newOwner.email}
          />
        )
      )}

      {/* Connections appear if pipe is unpublished */}
      {loading ? (
        <CustomSpinner />
      ) : (
        !flow.active && <FlowTransferConnections flow={flow} />
      )}

      <Flex flexDir="column" gap={2}>
        <Text textStyle="subhead-1">Transfer Pipe Ownership</Text>
        <Input
          disabled={shouldDisableInput}
          placeholder="Please type a valid account on Plumber e.g. me@example.gov.sg"
          value={newOwnerEmail}
          onChange={(event) => setNewOwnerEmail(event.target.value)}
        />

        <Button
          isDisabled={shouldDisableTransfer}
          onClick={onOpen}
          alignSelf="flex-end"
          mt={8}
        >
          Transfer Pipe
        </Button>

        {isOpen && (
          <TransferFlowModal onClose={onClose} newOwnerEmail={newOwnerEmail} />
        )}
      </Flex>
    </Flex>
  )
}
