import { ITransferDetails } from '@plumber/types'

import { useContext, useState } from 'react'
import { useQuery } from '@apollo/client'
import { Box, Center, Flex, Link, Stack, Text } from '@chakra-ui/react'
import { Badge, Infobox } from '@opengovsg/design-system-react'

import PrimarySpinner from '@/components/PrimarySpinner'
import { EditorSettingsContext } from '@/contexts/EditorSettings'
import { GET_FLOW_TRANSFER_DETAILS } from '@/graphql/queries/get-flow-transfer-details'

export default function SharedConnections() {
  const { flow } = useContext(EditorSettingsContext)
  const [showConnections, setShowConnections] = useState(false)
  const { data, loading } = useQuery(GET_FLOW_TRANSFER_DETAILS, {
    variables: {
      flowId: flow.id,
    },
  })
  const flowTransferDetails: ITransferDetails[] =
    data?.getFlowTransferDetails || []

  // NOTE: we group connections by app name to display them in a list
  // this is different from pipe transfer, where we display each connection individually
  const groupedConnections = flowTransferDetails?.reduce((acc, curr) => {
    if (!acc[curr.appName]) {
      acc[curr.appName] = new Set()
    }
    if (curr.connectionName) {
      acc[curr.appName].add(curr.connectionName)
    }
    return acc
  }, {} as Record<string, Set<string>>)

  if (loading) {
    return (
      <Center>
        <PrimarySpinner margin="auto" fontSize="4xl" />
      </Center>
    )
  }

  // hide infobox if no connections exist
  if (!loading && flowTransferDetails.length === 0) {
    return <></>
  }

  return (
    <Infobox variant="info" borderRadius="md" w="100%">
      <Flex flexDir="column" gap={2}>
        <Text textStyle="subhead-1">
          Editors will have access to these connections. They will only be able
          to use them in this pipe.{' '}
        </Text>
        <Text
          textStyle="body-1"
          color="base.content.default"
          as={Link}
          onClick={() => setShowConnections(!showConnections)}
        >
          {showConnections ? 'Hide connections' : 'Show connections'}
        </Text>
        {showConnections && (
          <Box>
            <Stack gap={2}>
              {Object.entries(groupedConnections).map(
                ([appName, connections], index) => (
                  <Flex flexDir="column" gap={2} key={index}>
                    <Badge colorScheme="info">{appName}</Badge>
                    {Array.from(connections)?.map((connection) => {
                      return (
                        <Flex flexDir="column" gap={2} key={connection}>
                          <Text textStyle="body-1" color="base.content.default">
                            {connection}
                          </Text>
                        </Flex>
                      )
                    })}
                  </Flex>
                ),
              )}
            </Stack>
          </Box>
        )}
      </Flex>
    </Infobox>
  )
}
