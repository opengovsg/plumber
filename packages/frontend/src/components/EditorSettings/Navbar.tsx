import { useContext } from 'react'
import { BiLeftArrowAlt } from 'react-icons/bi'
import { Link, useParams } from 'react-router-dom'
import { HStack, Icon, Text } from '@chakra-ui/react'
import { Button } from '@opengovsg/design-system-react'

import * as URLS from '@/config/urls'
import { EditorSettingsContext } from '@/contexts/EditorSettings'

export default function Navbar() {
  const { flowId } = useParams()
  const { flow } = useContext(EditorSettingsContext)

  const flowName = flow?.name ?? 'pipe'

  return (
    <HStack
      position="fixed"
      top={0}
      left={0}
      right={0}
      zIndex={10}
      bg="white"
      justifyContent="flex-start"
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
      />
      <Text textStyle="subhead-1">{flowName}</Text>
    </HStack>
  )
}
