import { IStep } from '@plumber/types'

import { useContext, useMemo } from 'react'
import { Flex } from '@chakra-ui/react'

import { buildStepsList } from '@/components/Editor/helpers/steps-utils'
import { SortableList } from '@/components/SortableList'
import { EditorContext } from '@/contexts/Editor'
import { StepsToDisplayContext } from '@/contexts/StepsToDisplay'
import { FlowStepGroup } from '@/exports/components'
import { TOOLBOX_ACTIONS } from '@/helpers/toolbox'
import { useIfThenV2Enabled } from '@/hooks/useIfThenV2Enabled'
import useReorderSteps from '@/hooks/useReorderSteps'

import GroupStepWithAddButton from '../../components/GroupStepWithAddButton'
import IfThen from '../IfThen/IfThen'

interface ForEachProps {
  groupedSteps: IStep[][]
  stepsBeforeGroup: IStep[]
}

export default function ForEach(props: ForEachProps) {
  const { groupedSteps } = props
  const { flow } = useContext(EditorContext)
  const { groupingActions } = useContext(StepsToDisplayContext)
  const { isEnabled: isIfThenV2Enabled, isLoading: isIfThenV2Loading } =
    useIfThenV2Enabled()
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
          isLastStep={hasNoActionSteps}
          allowReorder={false}
          showEmptyAction={hasNoActionSteps}
          canChildStepsReorder={actionSteps.length > 1}
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
                    allowReorder={actionSteps.length > 1}
                  />
                </Flex>
              </SortableList.Item>
            )
          }}
        />

        {ifThenSteps.length > 0 &&
          !isIfThenV2Loading &&
          (isIfThenV2Enabled ? (
            <Flex flexDir="column" w="100%" gap={2}>
              {buildStepsList(
                ifThenSteps.flat(),
                groupingActions ?? new Set<string>(),
              ).map((item, index, items) => {
                const isLastItem = index === items.length - 1

                if (item.type === 'ifThenBlock') {
                  return (
                    <IfThen
                      key={item.ifThenStep.id}
                      block={item}
                      isLastBlock={isLastItem}
                    />
                  )
                }

                if (item.type === 'step') {
                  // A plain step between/after if-then V2 blocks in the body —
                  // an explicit endStepId marker can end a block before the
                  // body's last step, unlike a derived if-then V1 extent.
                  return (
                    <GroupStepWithAddButton
                      key={item.step.id}
                      step={item.step}
                      canAddStep={true}
                      isLastStep={isLastItem}
                      allowReorder={false}
                    />
                  )
                }

                return null
              })}
            </Flex>
          ) : (
            <FlowStepGroup
              stepsBeforeGroup={forEachSteps}
              groupedSteps={ifThenSteps}
            />
          ))}
      </Flex>
    </Flex>
  )
}
