import { useMemo } from 'react'
import { FaCheck, FaTimes } from 'react-icons/fa'
import { Flex, Icon, Tag } from '@chakra-ui/react'

import { SingleSelect } from '@/components/SingleSelect'
import { type GroupedSteps } from '@/helpers/processExecutionSteps'

interface IterationSelectorProps {
  groupedSteps: GroupedSteps
  selectedIteration: string
  setSelectedIteration: (iteration: string) => void
}

export default function IterationSelector({
  groupedSteps,
  selectedIteration,
  setSelectedIteration,
}: IterationSelectorProps) {
  const selectedIterationStep = groupedSteps[Number(selectedIteration)]
  const isSelectedIterationSuccessful =
    selectedIterationStep?.status === 'success'

  const items = useMemo(() => {
    return groupedSteps.map(({ iteration, status }) => ({
      label: `Iteration ${iteration}`,
      value: iteration.toString(),
      badge:
        status === 'success' ? (
          <Icon as={FaCheck} color="green" ml={4} />
        ) : (
          <Icon as={FaTimes} color="red" ml={4} />
        ),
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
      <Tag
        colorScheme={isSelectedIterationSuccessful ? 'success' : 'critical'}
        size="lg"
      >
        {isSelectedIterationSuccessful ? 'Success' : 'Failure'}
      </Tag>
    </Flex>
  )
}
