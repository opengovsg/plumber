import { ITransferDetails } from '@plumber/types'

import { useContext } from 'react'
import { useQuery } from '@apollo/client'
import { Center, Flex, Text } from '@chakra-ui/react'
import { Badge, Infobox } from '@opengovsg/design-system-react'

import PrimarySpinner from '@/components/PrimarySpinner'
import { EditorSettingsContext } from '@/contexts/EditorSettings'
import { GET_FLOW_TRANSFER_DETAILS } from '@/graphql/queries/get-flow-transfer-details'

function StepConnectionDisplay(props: ITransferDetails) {
  const { appName, position, connectionName, instructions } = props
  return (
    <Flex flexDir="column" gap={2}>
      <Badge colorScheme="warning">
        Step {position}: {appName}
      </Badge>
      <Text textStyle="body-1" color="base.content.default">
        {connectionName}
      </Text>
      <Text textStyle="body-1" color="base.content.medium">
        {instructions}
      </Text>
    </Flex>
  )
}

export default function FlowTransferConnections() {
  const { flow } = useContext(EditorSettingsContext)
  // phase 1: just retrieve all transfer details to display (without instructions)
  const { data, loading } = useQuery(GET_FLOW_TRANSFER_DETAILS, {
    variables: {
      flowId: flow.id,
    },
  })
  const flowTransferDetails: ITransferDetails[] = data?.getFlowTransferDetails

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
    <Infobox variant="warning">
      <Flex flexDir="column" gap={6}>
        <Text textStyle="subhead-1">
          You will need to manually add the following connections on the new
          pipe owner&apos;s account for the pipe to continue working.
        </Text>

        {flowTransferDetails.map(
          ({ appName, position, connectionName, instructions }, index) => (
            <StepConnectionDisplay
              key={index}
              appName={appName}
              position={position}
              connectionName={connectionName}
              instructions={instructions}
            />
          ),
        )}
      </Flex>
    </Infobox>
  )
}
