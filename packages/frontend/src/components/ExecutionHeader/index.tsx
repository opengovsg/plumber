import type { IExecution } from '@plumber/types'

import { Fragment, ReactElement, useCallback } from 'react'
import { BiChevronLeft } from 'react-icons/bi'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Flex, Icon, Link, Stack, Text } from '@chakra-ui/react'
import { Button, Tooltip } from '@opengovsg/design-system-react'
import { DateTime } from 'luxon'

import * as URLS from '@/config/urls'

type ExecutionHeaderProps = {
  execution: IExecution
}

function ExecutionName(props: Pick<IExecution['flow'], 'name' | 'id'>) {
  const { id, name } = props
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const backToPage = searchParams.get('backToPage')

  const handleBack = useCallback(() => {
    let backUrl = URLS.EXECUTIONS_FOR_FLOW(id)

    if (backToPage && /^\d+$/.test(backToPage)) {
      backUrl += `?page=${backToPage}`
    }
    navigate(backUrl)
  }, [navigate, id, backToPage])

  return (
    <Flex gap={2} alignItems="center">
      <Button as={Link} variant="link" onClick={handleBack}>
        <Icon
          boxSize={6}
          color="interaction.support.disabled-content"
          as={BiChevronLeft}
        />
      </Button>
      <Text textStyle="h4">{name}</Text>
    </Flex>
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
  const { flow } = execution

  if (!execution) {
    return <Fragment />
  }

  return (
    <Stack direction="column">
      <Stack
        direction={{ base: 'column', sm: 'row' }}
        justifyContent="space-between"
        alignItems="center"
      >
        <ExecutionName name={flow.name} id={flow.id} />
        <ExecutionId id={execution.id} />
      </Stack>

      <Stack direction="row" justifyContent="flex-end">
        <ExecutionDate createdAt={execution.createdAt} />
      </Stack>
    </Stack>
  )
}
