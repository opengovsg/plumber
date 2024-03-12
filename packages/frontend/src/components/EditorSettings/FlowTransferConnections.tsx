import { IFlow } from '@plumber/types'

import { useMemo } from 'react'
import { useQuery } from '@apollo/client'
import { Center, Flex, Text } from '@chakra-ui/react'
import { Infobox, Spinner } from '@opengovsg/design-system-react'
import { GET_FLOW } from 'graphql/queries/get-flow'

interface FlowTransferConnectionsProps {
  flowId?: string
}

interface StepConnectionDetails {
  appKey: string
  position: number
  screenName: string
}

function StepConnectionDisplay(props: StepConnectionDetails) {
  const { appKey, position, screenName } = props
  return (
    <Flex flexDir="column">
      <Text textStyle="subhead-3">
        Step {position}: {appKey} connection
      </Text>
      <Text textStyle="body-2">Label: {screenName}</Text>
    </Flex>
  )
}

export default function FlowTransferConnections(
  props: FlowTransferConnectionsProps,
) {
  const { flowId } = props
  const { data, loading } = useQuery(GET_FLOW, { variables: { id: flowId } })
  const flow: IFlow = data?.getFlow

  // phase 1: just retrieve all connections to display using the getFlow query
  // TODO (mal): move to backend query if necessary
  const stepConnectionDetails: StepConnectionDetails[] = useMemo(
    () =>
      flow?.steps.reduce((res: StepConnectionDetails[], step) => {
        if (step?.connection) {
          res.push({
            screenName:
              (step?.connection?.formattedData?.screenName as string) ??
              'Unknown screen name',
            appKey: step.appKey ?? 'Unknown app key',
            position: step.position,
          })
        }
        return res
      }, []),
    [flow?.steps],
  )

  if (loading) {
    return (
      <Center mt={4}>
        <Spinner color="primary.600" margin="auto" fontSize="4xl" />
      </Center>
    )
  }

  return (
    <Infobox mt={2} variant="warning">
      <Flex flexDir="column" gap={4}>
        <Text textStyle="body-1">
          You will need to manually create the following connections on the new
          Pipe owner&apos;s account for the pipe to continue to work.{' '}
          <strong>
            Please note that these connections will remain with you.
          </strong>
        </Text>

        {stepConnectionDetails.map(
          ({ appKey, position, screenName }, index) => (
            <StepConnectionDisplay
              key={index}
              appKey={appKey}
              position={position}
              screenName={screenName}
            />
          ),
        )}
      </Flex>
    </Infobox>
  )
}
