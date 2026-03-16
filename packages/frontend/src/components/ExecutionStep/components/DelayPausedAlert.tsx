import type { IExecution } from '@plumber/types'

import { Link } from 'react-router-dom'
import { Divider, Flex, Text } from '@chakra-ui/react'
import { Infobox } from '@opengovsg/design-system-react'

import { FLOW_EDITOR } from '@/config/urls'

interface DelayPausedAlertProps {
  execution: IExecution
}

/**
 * TODO: Change this component name if there are more use cases that involve "pausing" the pipe
 */
export default function DelayPausedAlert({
  execution,
}: DelayPausedAlertProps): React.ReactElement {
  const flowId = execution.flow?.id
  const flowName = execution.flow?.name

  return (
    <Flex direction="column" align="stretch" gap={4}>
      <Infobox variant="info" borderRadius="lg">
        <Flex flexDir="column" gap={4}>
          <Flex flexDir="column" gap={2}>
            <Text textStyle="subhead-1">This execution was paused</Text>
            <Text textStyle="body-1">
              The scheduled date had already passed when this workflow ran. This
              happened because you chose to pause executions in this situation.
            </Text>
          </Flex>

          <Divider />
          {flowId && (
            <Flex textStyle="body-1" gap={1}>
              <Text>Workflow:</Text>
              <Link
                to={FLOW_EDITOR(flowId)}
                target="_blank"
                color="primary.500"
              >
                <Flex align="center" gap={1} color="primary.500">
                  <Text>{flowName}</Text>
                  <Text mb="-1" fontSize="1rem">
                    ↗
                  </Text>
                </Flex>
              </Link>
            </Flex>
          )}
        </Flex>
      </Infobox>
    </Flex>
  )
}
