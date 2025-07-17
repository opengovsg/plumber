import { useMemo } from 'react'
import { Flex, Tag } from '@chakra-ui/react'
import startCase from 'lodash/startCase'

import { GroupStats } from '@/helpers/processExecutionSteps'

import { SingleSelect } from '../SingleSelect/SingleSelect'

export enum GroupStatusType {
  All = 'all',
  Success = 'success',
  Failure = 'failure',
  Waiting = 'waiting',
  PartialSuccess = 'partial-success',
}

interface GroupStatusFilterProps {
  statusFilter: GroupStatusType
  groupStats: GroupStats
  setStatusFilter: (status: GroupStatusType) => void
}

const getLabel = (status: GroupStatusType, count: number) => {
  let colorScheme = 'gray'
  if (status === GroupStatusType.Success) {
    colorScheme = 'success'
  } else if (status === GroupStatusType.Failure) {
    colorScheme = 'critical'
  } else if (
    status === GroupStatusType.Waiting ||
    status === GroupStatusType.PartialSuccess
  ) {
    colorScheme = 'warning'
  }
  return (
    <Flex alignItems="center" gap={4}>
      {startCase(status)} {getTag(colorScheme, count)}
    </Flex>
  )
}

const getTag = (colorScheme: string, text: string | number) => {
  return (
    <Tag colorScheme={colorScheme} size="xs" borderRadius="lg">
      {text}
    </Tag>
  )
}

export default function GroupStatusFilter({
  statusFilter,
  groupStats,
  setStatusFilter,
}: GroupStatusFilterProps) {
  const items = useMemo(() => {
    const {
      failure,
      success,
      waiting,
      'partial-success': partialSuccess,
    } = groupStats
    const allCount = success + failure + waiting + partialSuccess

    return [
      {
        label: getLabel(GroupStatusType.All, allCount),
        value: GroupStatusType.All,
      },
      {
        label: getLabel(GroupStatusType.Success, success),
        value: GroupStatusType.Success,
        disabled: success === 0,
      },
      {
        label: getLabel(GroupStatusType.PartialSuccess, partialSuccess),
        value: GroupStatusType.PartialSuccess,
        disabled: partialSuccess === 0,
      },
      {
        label: getLabel(GroupStatusType.Failure, failure),
        value: GroupStatusType.Failure,
        disabled: failure === 0,
      },
      {
        label: getLabel(GroupStatusType.Waiting, waiting),
        value: GroupStatusType.Waiting,
        disabled: waiting === 0,
      },
    ]
  }, [groupStats])

  return (
    <SingleSelect
      items={items}
      isSearchable={false}
      onChange={(value) => setStatusFilter(value as GroupStatusType)}
      value={statusFilter}
      name="groupStatus"
      placeholder="Status"
      isClearable={false}
      colorScheme="secondary"
      isBorderless={true}
    />
  )
}
