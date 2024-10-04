import type { IFlowTransfer } from '@plumber/types'

import { BiLoader } from 'react-icons/bi'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@apollo/client'
import { Flex, Icon, Text } from '@chakra-ui/react'
import { Button, Infobox } from '@opengovsg/design-system-react'

import * as URLS from '@/config/urls'
import { GET_PENDING_FLOW_TRANSFERS } from '@/graphql/queries/get-pending-flow-transfers'

export default function ApproveTransfersInfobox() {
  const { data, loading } = useQuery(GET_PENDING_FLOW_TRANSFERS)
  const flowTransfers: IFlowTransfer[] = data?.getPendingFlowTransfers
  const count = flowTransfers?.length
  const navigate = useNavigate()

  if (loading || count === 0) {
    return <></>
  }

  return (
    <Infobox
      icon={<Icon as={BiLoader} color="primary.500" />}
      alignItems="center"
      style={{ borderRadius: '0.25rem', backgroundColor: '#F9DDE9' }}
      mb={4}
    >
      <Flex justifyContent="space-between" alignItems="center" flex={1}>
        <Text color="primary.500">{`${count} pipe transfer(s) to accept`}</Text>
        <Button
          variant="clear"
          size="sm"
          onClick={() => navigate(URLS.TRANSFERS)}
        >
          View and accept
        </Button>
      </Flex>
    </Infobox>
  )
}
