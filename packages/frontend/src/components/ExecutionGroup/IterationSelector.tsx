// import { IExecution } from '@plumber/types'

import { useMemo } from 'react'
import { Flex, Tag } from '@chakra-ui/react'

import { SingleSelect } from '@/components/SingleSelect'
import { type GroupedSteps } from '@/helpers/processExecutionSteps'

// import { RetryAllButton } from '../ExecutionStep/components/RetryAllButton'
import { GroupStatusType } from './GroupStatusFilter'

interface IterationSelectorProps {
  // canRetryAll: boolean
  // execution: IExecution
  groupedSteps: GroupedSteps
  selectedIteration: string
  setSelectedIteration: (iteration: string) => void
}

export default function IterationSelector({
  // canRetryAll,
  // execution,
  groupedSteps,
  selectedIteration,
  setSelectedIteration,
}: IterationSelectorProps) {
  const items = useMemo(() => {
    return groupedSteps.map(({ iteration, status }) => ({
      label: (
        <Flex alignItems="center" gap={4}>
          Item {iteration}
          <Tag
            colorScheme={
              status === GroupStatusType.Waiting
                ? 'gray'
                : status === GroupStatusType.Success
                ? 'success'
                : 'critical'
            }
            size="xs"
            borderRadius="md"
          >
            {status === GroupStatusType.Waiting
              ? 'Waiting'
              : status === GroupStatusType.Success
              ? 'Success'
              : 'Failure'}
          </Tag>
        </Flex>
      ),
      value: iteration.toString(),
    }))
  }, [groupedSteps])

  return (
    <Flex justifyContent="space-between" alignItems="center">
      <SingleSelect
        items={items}
        isSearchable={false}
        onChange={setSelectedIteration}
        value={selectedIteration}
        name="forEachIteration"
        placeholder="Select an option"
        isClearable={false}
        colorScheme="secondary"
      />
      {/* TODO: add retry buttons */}
      {/* {canRetryAll && <RetryAllButton execution={execution} type="iteration" />} */}
    </Flex>
  )
}
