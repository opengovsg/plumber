import { IStep } from '@plumber/types'

import { useContext, useMemo } from 'react'
import { Flex } from '@chakra-ui/react'

import { SortableList } from '@/components/SortableList'
import { EditorContext } from '@/contexts/Editor'
import { FlowStepGroup } from '@/exports/components'
import { TOOLBOX_ACTIONS } from '@/helpers/toolbox'
import useReorderSteps from '@/hooks/useReorderSteps'

import GroupStepWithAddButton from '../../components/GroupStepWithAddButton'

interface ForEachProps {
  groupedSteps: IStep[][]
  stepsBeforeGroup: IStep[]
}

export default function ForEach(props: ForEachProps) {
  const { groupedSteps } = props
  const { flow } = useContext(EditorContext)
  const { handleReorderUpdate } = useReorderSteps(flow.id)

  const forEachSteps = groupedSteps[0]
  const ifThenSteps = useMemo(() => {
    if (groupedSteps.length === 1) {
      return []
    }
    return groupedSteps.slice(1)
  }, [groupedSteps])

  // NOTE: groupedSteps includes for-each and if-then actions
  // so groupedSteps === 1 means that there is only the for-each action
  const nonForEachActionSteps = forEachSteps.filter(
    (step) => step.type === 'action' && step.key !== TOOLBOX_ACTIONS.ForEach,
  )
  const hasNoActionSteps =
    nonForEachActionSteps.length === 0 && groupedSteps.length === 1

  const { conditionStep, actionSteps } = useMemo(() => {
    const conditionStep = forEachSteps[0]
    const actionSteps = forEachSteps.slice(1)

    return { conditionStep, actionSteps }
  }, [forEachSteps])

  const handleReorderSteps = async (items: any[]) => {
    const forEachPosition = conditionStep.position
    const stepPositions = items.map((item, index) => ({
      id: item.id,
      position: forEachPosition + index + 1, // index is 0-based
      type: item.step.type,
    }))

    try {
      handleReorderUpdate(stepPositions)
    } catch (error) {
      console.error(
        'Error updating step positions: ',
        error,
        JSON.stringify(stepPositions),
      )
    }
  }

  return (
    <Flex flexDir="column" alignItems="center" borderRadius="lg" w="100%">
      <Flex flexDir="column" w="100%" px={4} py={3}>
        <GroupStepWithAddButton
          step={conditionStep}
          canAddStep={true}
          isLastStep={false}
          allowReorder={false}
          showEmptyAction={hasNoActionSteps}
        />
        <SortableList
          items={actionSteps.map((step, index) => ({
            id: step.id,
            step,
            index,
          }))}
          onChange={handleReorderSteps}
          renderItem={(item, isOverlay) => {
            const { step, index } = item
            const isLastStep =
              index === actionSteps.length - 1 && ifThenSteps.length === 0
            return (
              <SortableList.Item id={item.id}>
                <Flex w="100%" flexDir="column">
                  <GroupStepWithAddButton
                    step={step}
                    canAddStep={true}
                    isLastStep={isLastStep}
                    isOverlay={isOverlay}
                    allowReorder={true}
                  />
                </Flex>
              </SortableList.Item>
            )
          }}
        />

        {ifThenSteps.length > 0 && (
          <FlowStepGroup
            stepsBeforeGroup={forEachSteps}
            groupedSteps={ifThenSteps}
          />
        )}
      </Flex>
    </Flex>
  )
}
