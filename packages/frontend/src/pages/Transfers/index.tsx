import { IFlowTransfer } from '@plumber/types'

import { BiLeftArrowAlt } from 'react-icons/bi'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@apollo/client'
import { Center, Flex, Icon, Text, useDisclosure } from '@chakra-ui/react'
import { Button, Spinner } from '@opengovsg/design-system-react'
import Container from 'components/Container'
import { GET_PENDING_FLOW_TRANSFERS } from 'graphql/queries/get-pending-flow-transfers'

import * as URLS from './../../config/urls'
import TransferRequestRow from './components/TransferRequestRow'

export default function Transfers() {
  const { isOpen, onOpen, onClose } = useDisclosure()
  const navigate = useNavigate()

  const { data, loading } = useQuery(GET_PENDING_FLOW_TRANSFERS)
  const flowTransfers: IFlowTransfer[] = data?.getPendingFlowTransfers

  return (
    <Container>
      <Flex flexDir="column">
        <Flex mb={6} px={8} alignItems="center" justifyContent="space-between">
          <Text textStyle="h4">Pipe Transfers</Text>
          <Button
            size="sm"
            onClick={() => navigate(URLS.FLOWS)}
            leftIcon={<Icon as={BiLeftArrowAlt} boxSize={5} />}
          >
            Back to pipes
          </Button>
        </Flex>
        {loading ? (
          <Center>
            <Spinner fontSize="4xl" color="primary.600" />
          </Center>
        ) : flowTransfers.length === 0 ? (
          // TODO (mal): check if this needs to be beautified?
          <Center py="11rem">
            <Text textStyle="h4" color="base.content.medium">
              You have no pending pipe transfers
            </Text>
          </Center>
        ) : (
          flowTransfers.map((flowTransfer: IFlowTransfer) => (
            <TransferRequestRow
              key={flowTransfer.id}
              flowTransfer={flowTransfer}
              isOpen={isOpen}
              onOpen={onOpen}
              onClose={onClose}
            />
          ))
        )}
      </Flex>
    </Container>
  )
}
