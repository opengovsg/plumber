import { IFlow } from '@plumber/types'

import { useCallback, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useMutation, useQuery } from '@apollo/client'
import { Center, Flex, Text, useDisclosure } from '@chakra-ui/react'
import { Button, Infobox, Input, Spinner } from '@opengovsg/design-system-react'
import { UPDATE_FLOW_STATUS } from 'graphql/mutations/update-flow-status'
import { GET_FLOW } from 'graphql/queries/get-flow'

import FlowTransferConnections from './FlowTransferConnections'
import FlowTransferModal from './FlowTransferModal'

export default function FlowTransfer() {
  const { isOpen, onOpen, onClose } = useDisclosure()

  const { flowId } = useParams()
  const [newOwnerEmail, setNewOwnerEmail] = useState<string>('')
  const { data, loading } = useQuery(GET_FLOW, { variables: { id: flowId } })
  const [updateFlowStatus] = useMutation(UPDATE_FLOW_STATUS)
  const flow: IFlow = data?.getFlow

  const onFlowStatusUpdate = useCallback(
    async (active: boolean) => {
      await updateFlowStatus({
        variables: {
          input: {
            id: flowId,
            active,
          },
        },
        optimisticResponse: {
          updateFlowStatus: {
            __typename: 'Flow',
            id: flow?.id,
            active,
          },
        },
      })
    },
    [flow?.id, flowId, updateFlowStatus],
  )

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

      {loading ? (
        <Center>
          <Spinner color="primary.600" margin="auto" fontSize="4xl" />
        </Center>
      ) : (
        flow?.active && (
          <Infobox alignItems="center">
            <Flex
              gap={12}
              justifyContent="space-between"
              alignItems="center"
              flex={1}
            >
              <Text>
                You will need to unpublish your pipe before you transfer it
              </Text>
              <Button
                onClick={() => onFlowStatusUpdate(!flow.active)}
                variant="outline"
                colorScheme="secondary"
              >
                Unpublish pipe
              </Button>
            </Flex>
          </Infobox>
        )
      )}

      <Flex flexDir="column" gap={2}>
        <Text textStyle="subhead-1">Transfer Pipe Ownership</Text>
        <Input
          disabled={flow?.active}
          placeholder="Please type a valid account on Plumber e.g. me@example.gov.sg"
          value={newOwnerEmail}
          onChange={(event) => setNewOwnerEmail(event.target.value)}
        />
        <FlowTransferConnections flowId={flowId} />
        <Button
          isDisabled={flow?.active || newOwnerEmail === ''}
          onClick={onOpen}
          alignSelf="flex-end"
          mt={8}
        >
          Transfer Pipe
        </Button>
        {isOpen && (
          <FlowTransferModal
            onClose={onClose}
            flowId={flowId}
            newOwnerEmail={newOwnerEmail}
          />
        )}
      </Flex>
    </Flex>
  )
}
