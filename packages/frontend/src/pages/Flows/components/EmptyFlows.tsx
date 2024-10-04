import { useNavigate } from 'react-router-dom'
import { Box, Flex, Hide, Text, useDisclosure } from '@chakra-ui/react'
import { Tile } from '@opengovsg/design-system-react'

import NavigationDrawer from '@/components/Layout/NavigationDrawer'
import * as URLS from '@/config/urls'
import { TemplateIcon } from '@/helpers/flow-templates'
import CreateFlowModal from '@/pages/Flows/components/CreateFlowModal'

export default function EmptyFlows() {
  const navigate = useNavigate()

  // for creation of flows
  const {
    isOpen: isCreateFlowModalOpen,
    onOpen: onCreateFlowModalOpen,
    onClose: onCreateFlowModalClose,
  } = useDisclosure()

  return (
    <>
      <Flex
        maxW="600px"
        margin="auto"
        rowGap={4}
        flexDir="column"
        pt={{ base: '0', md: '10vh' }}
      >
        <Flex maxW="400px">
          <Hide above="sm">
            <Box mt={-1.5}>
              <NavigationDrawer />
            </Box>
          </Hide>
          <Text textStyle="h3">How do you want to create your pipe?</Text>
        </Flex>

        <Flex gap={4} wrap="wrap" flexDir={{ base: 'column', md: 'row' }}>
          <Tile
            icon={() => (
              <Box py={2}>
                <TemplateIcon iconName={'BiBookOpen'} fontSize="2rem" />
              </Box>
            )}
            display="flex"
            flex="1"
            onClick={() => navigate(URLS.TEMPLATES)}
          >
            <Flex flexDir="column" gap={2} mt={2}>
              <Text textStyle="subhead-1">Use a template</Text>
              <Text textStyle="body-2">
                Select from pre-built workflows that you can use as-is or
                customize further for your own use case
              </Text>
            </Flex>
          </Tile>

          <Tile
            icon={() => (
              <Box py={2}>
                <TemplateIcon iconName={'BiPlus'} fontSize="2rem" />
              </Box>
            )}
            display="flex"
            flex="1"
            onClick={onCreateFlowModalOpen}
          >
            <Flex flexDir="column" gap={2} mt={2}>
              <Text textStyle="subhead-1">Start from scratch</Text>
              <Text textStyle="body-2">
                Use our workflow builder to create your own workflow
              </Text>
            </Flex>
          </Tile>
        </Flex>
      </Flex>

      {isCreateFlowModalOpen && (
        <CreateFlowModal onClose={onCreateFlowModalClose} />
      )}
    </>
  )
}
