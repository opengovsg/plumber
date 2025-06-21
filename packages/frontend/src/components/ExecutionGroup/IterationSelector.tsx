// import { IExecution } from '@plumber/types'

import { IExecutionStep } from '@plumber/types'

import { useMemo } from 'react'
import { Flex, Tag } from '@chakra-ui/react'

import { SingleSelect } from '@/components/SingleSelect'

import RetryButton from '../ExecutionStep/components/RetryButton'

// import { RetryAllButton } from '../ExecutionStep/components/RetryAllButton'
import { GroupStatusType } from './GroupStatusFilter'

interface IterationSelectorProps {
  iterationMap: Map<number, string>
  selectedIteration: string
  setSelectedIteration: (iteration: string) => void
  iterationSteps: IExecutionStep[]
}

export default function IterationSelector({
  iterationMap,
  selectedIteration,
  setSelectedIteration,
  iterationSteps,
}: IterationSelectorProps) {
  const items = useMemo(() => {
    return Array.from(iterationMap.entries()).map(([iteration, status]) => ({
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
  }, [iterationMap])

  const { executionStepId, canRetry } = useMemo(() => {
    const executionStepId = iterationSteps?.[iterationSteps?.length - 1]?.id
    const canRetry =
      !!iterationSteps &&
      iterationSteps?.[iterationSteps?.length - 1]?.status ===
        GroupStatusType.Failure &&
      executionStepId

    return { executionStepId, canRetry }
  }, [iterationSteps])

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
      {canRetry && (
        <RetryButton
          executionStepId={executionStepId}
          customButtonText="Retry this item"
        />
      )}
      {/* TODO: add retry all button */}
      {/* {canRetryAll && <RetryAllButton execution={execution} type="iteration" />} */}
    </Flex>
  )
}
