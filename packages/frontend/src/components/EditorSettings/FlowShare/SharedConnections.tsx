import { ITransferDetails } from '@plumber/types'

import { useContext } from 'react'
import { useQuery } from '@apollo/client'
import { Center, Flex, Text } from '@chakra-ui/react'
import { Badge, Infobox } from '@opengovsg/design-system-react'

import PrimarySpinner from '@/components/PrimarySpinner'
import { EditorSettingsContext } from '@/contexts/EditorSettings'
import { GET_FLOW_TRANSFER_DETAILS } from '@/graphql/queries/get-flow-transfer-details'

export default function SharedConnections() {
  const { flow } = useContext(EditorSettingsContext)
  const { data, loading } = useQuery(GET_FLOW_TRANSFER_DETAILS, {
    variables: {
      flowId: flow.id,
    },
  })
  const flowTransferDetails: ITransferDetails[] =
    data?.getFlowTransferDetails || []

  // NOTE: we group connections by app name to display them in a list
  // this is different from pipe transfer, where we display each connection individually
  const groupedConnections = flowTransferDetails.reduce((acc, curr) => {
    acc[curr.appName] = acc[curr.appName] || []
    acc[curr.appName].push(curr)
    return acc
  }, {} as Record<string, ITransferDetails[]>)

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
      <Flex flexDir="column" gap={6}>
        <Text textStyle="subhead-1">
          Editors will have access to these connections. They will only be able
          to use them in this pipe.
        </Text>

        {Object.entries(groupedConnections).map(
          ([appName, connections], index) => (
            <Flex flexDir="column" gap={2} key={index}>
              <Badge colorScheme="info">{appName}</Badge>
              {connections?.map((connection) => {
                return (
                  <Flex
                    flexDir="column"
                    gap={2}
                    key={`${connection.position}-${connection.connectionName}`}
                  >
                    <Text textStyle="body-1" color="base.content.default">
                      {connection.connectionName}
                    </Text>
                  </Flex>
                )
              })}
            </Flex>
          ),
        )}
      </Flex>
    </Infobox>
  )
}
