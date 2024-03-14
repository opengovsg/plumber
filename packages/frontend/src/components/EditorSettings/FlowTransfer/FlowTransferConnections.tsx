import { IApp, IFlow } from '@plumber/types'

import { useMemo } from 'react'
import { useQuery } from '@apollo/client'
import { Flex, Text } from '@chakra-ui/react'
import { Badge, Infobox } from '@opengovsg/design-system-react'
import { GET_APPS } from 'graphql/queries/get-apps'

import { CustomSpinner } from '../FlowTransfer'

interface FlowTransferConnectionsProps {
  flow: IFlow
}

interface StepConnectionDetails {
  appName: string
  position: number
  screenName: string
}

function StepConnectionDisplay(props: StepConnectionDetails) {
  const { appName, position, screenName } = props
  return (
    <Flex flexDir="column" gap={2}>
      <Badge colorScheme="warning">
        Step {position}: {appName}
      </Badge>
      <Text textStyle="body-1">{screenName}</Text>
    </Flex>
  )
}

export default function FlowTransferConnections(
  props: FlowTransferConnectionsProps,
) {
  const { flow } = props
  const { data, loading } = useQuery(GET_APPS) // used for better UI display
  const apps: IApp[] = data?.getApps

  // phase 1: just retrieve all connections to display
  // TODO (mal): move to backend query if necessary
  const stepConnectionDetails: StepConnectionDetails[] = useMemo(
    () =>
      flow?.steps.reduce((res: StepConnectionDetails[], step) => {
        if (step?.connection) {
          res.push({
            screenName:
              (step?.connection?.formattedData?.screenName as string) ??
              'Unknown screen name',
            appName:
              apps?.find((app) => app.key === step.appKey)?.name ??
              'Unknown app',
            position: step.position,
          })
        }
        return res
      }, []),
    [flow?.steps, apps],
  )

  if (loading) {
    return <CustomSpinner />
  }

  return (
    <Infobox variant="warning">
      <Flex flexDir="column" gap={6}>
        <Text textStyle="subhead-1">
          You will need to manually add the following connections on the new
          pipe owner&apos;s account for the pipe to continue working.
        </Text>

        {stepConnectionDetails.map(
          ({ appName, position, screenName }, index) => (
            <StepConnectionDisplay
              key={index}
              appName={appName}
              position={position}
              screenName={screenName}
            />
          ),
        )}
      </Flex>
    </Infobox>
  )
}
