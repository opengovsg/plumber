import { IFlowTransfer } from '@plumber/types'

import { BiLeftArrowAlt } from 'react-icons/bi'
import { Link } from 'react-router-dom'
import { useQuery } from '@apollo/client'
import { Center, Flex, Icon, Text, useDisclosure } from '@chakra-ui/react'
import { Button, Spinner } from '@opengovsg/design-system-react'
import Container from 'components/Container'
import { GET_PENDING_FLOW_TRANSFERS } from 'graphql/queries/get-pending-flow-transfers'

import * as URLS from './../../config/urls'
import TransferRequestRow from './components/TransferRequestRow'

export default function Transfers() {
  const { isOpen, onOpen, onClose } = useDisclosure()

  const { data, loading } = useQuery(GET_PENDING_FLOW_TRANSFERS)
  const flowTransfers: IFlowTransfer[] = data?.getPendingFlowTransfers

  return (
    <Container>
      <Flex flexDir="column">
        <Flex
          flexDir="column"
          mb={6}
          px={8}
          gap={11}
          justifyContent="space-between"
        >
          <Button
            as={Link}
            to={URLS.FLOWS}
            leftIcon={<Icon as={BiLeftArrowAlt} boxSize={5} />}
            variant="link"
            color="primary.600"
          >
            <Text textStyle="subhead-1">Back to dashboard</Text>
          </Button>
          <Text textStyle="h4">Pipe Transfers</Text>
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
