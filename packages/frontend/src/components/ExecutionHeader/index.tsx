import type { IExecution } from '@plumber/types'

import { Fragment, ReactElement } from 'react'
import { Flex, Stack, Text } from '@chakra-ui/react'
import { Tooltip } from '@opengovsg/design-system-react'
import { DateTime } from 'luxon'

type ExecutionHeaderProps = {
  execution: IExecution
}

function ExecutionName(props: Pick<IExecution['flow'], 'name'>) {
  return (
    <Text textStyle="h4" mb={4}>
      {props.name}
    </Text>
  )
}

function ExecutionId(props: Pick<IExecution, 'id'>) {
  return (
    <Flex>
      <Text textStyle="h5">
        Execution ID:{' '}
        <Text as="span" textStyle="body-1">
          {props.id}
        </Text>
      </Text>
    </Flex>
  )
}

function ExecutionDate(props: Pick<IExecution, 'createdAt'>) {
  const createdAt = DateTime.fromMillis(parseInt(props.createdAt, 10))
  const relativeCreatedAt = createdAt.toRelative()

  return (
    <Tooltip
      label={createdAt.toLocaleString(DateTime.DATE_MED)}
      aria-label="Created at tooltip"
    >
      <Text textStyle="body-1">{relativeCreatedAt}</Text>
    </Tooltip>
  )
}

export default function ExecutionHeader(
  props: ExecutionHeaderProps,
): ReactElement {
  const { execution } = props

  if (!execution) {
    return <Fragment />
  }

  return (
    <Stack direction="column">
      <Stack
        direction={{ base: 'column', sm: 'row' }}
        justifyContent="space-between"
      >
        <ExecutionDate createdAt={execution.createdAt} />
        <ExecutionId id={execution.id} />
      </Stack>

      <Stack direction="row">
        <ExecutionName name={execution.flow.name} />
      </Stack>
    </Stack>
  )
}
