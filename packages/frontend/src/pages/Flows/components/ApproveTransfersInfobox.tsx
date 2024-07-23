import { BiLoader } from 'react-icons/bi'
import { useNavigate } from 'react-router-dom'
import { Flex, Icon, Text } from '@chakra-ui/react'
import { Button, Infobox } from '@opengovsg/design-system-react'

import * as URLS from '../../../config/urls'

interface ApproveTransfersInfoboxProps {
  count: number
}

export default function ApproveTransfersInfobox(
  props: ApproveTransfersInfoboxProps,
) {
  const { count } = props
  const navigate = useNavigate()
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
