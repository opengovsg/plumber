import { BiLeftArrowAlt } from 'react-icons/bi'
import { Link, useParams } from 'react-router-dom'
import { HStack, Icon, Text } from '@chakra-ui/react'
import { Button } from '@opengovsg/design-system-react'
import * as URLS from 'config/urls'

export default function Navbar() {
  const { flowId } = useParams()
  return (
    <HStack
      bg="white"
      w="100%"
      justifyContent="space-between"
      alignItems="center"
      py={5}
      px={6}
      borderBottom="1px solid"
      borderColor="base.divider.medium"
      gap={4}
    >
      <Button
        as={Link}
        to={URLS.FLOW_EDITOR(flowId)}
        variant="link"
        leftIcon={<Icon as={BiLeftArrowAlt} boxSize={5} />}
        color="primary.500"
      >
        <Text textStyle="subhead-1">Back to pipe</Text>
      </Button>
    </HStack>
  )
}
