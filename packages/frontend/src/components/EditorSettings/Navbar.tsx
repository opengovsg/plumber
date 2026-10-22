import { useContext } from 'react'
import { BiChevronLeft } from 'react-icons/bi'
import { Link, useParams } from 'react-router-dom'
import { Box, HStack, Icon, Text } from '@chakra-ui/react'

import { TOP_NAV_HEIGHT } from '@/config/layout'
import * as URLS from '@/config/urls'
import { EditorSettingsContext } from '@/contexts/EditorSettings'

export default function Navbar() {
  const { flowId } = useParams()
  const { flow } = useContext(EditorSettingsContext)

  const flowName = flow?.name ?? 'pipe'

  return (
    <HStack
      spacing={0}
      position="fixed"
      top={0}
      left={0}
      right={0}
      zIndex={10}
      bg="white"
      justifyContent="flex-start"
      alignItems="center"
      h={TOP_NAV_HEIGHT}
      px={{ base: 4, md: 8 }}
      borderBottom="1px solid"
      borderColor="base.divider.medium"
    >
      <Box
        as={Link}
        to={URLS.FLOW_EDITOR(flowId)}
        aria-label="Back to pipe"
        mt={1}
        ml="-7px"
        mr={2}
        flexShrink={0}
      >
        <Icon boxSize={6} color="base.content.default" as={BiChevronLeft} />
      </Box>
      <Text fontWeight={500} noOfLines={1}>
        {flowName}
      </Text>
    </HStack>
  )
}
