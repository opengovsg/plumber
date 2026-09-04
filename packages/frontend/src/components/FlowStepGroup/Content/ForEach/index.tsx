import { IStep } from '@plumber/types'

import { useCallback, useContext, useMemo } from 'react'
import { BiTrash } from 'react-icons/bi'
import { Flex } from '@chakra-ui/react'
import { IconButton } from '@opengovsg/design-system-react'

import {
  buildStepsList,
  type IfThenBlock,
  type SingleStep,
} from '@/components/Editor/helpers/steps-utils'
import { SortableList } from '@/components/SortableList'
import { EditorContext } from '@/contexts/Editor'
import { StepsToDisplayContext } from '@/contexts/StepsToDisplay'
import { StepEnumType } from '@/graphql/__generated__/graphql'
import { TOOLBOX_ACTIONS } from '@/helpers/toolbox'
import useReorderSteps from '@/hooks/useReorderSteps'

import BlockHeader from '../../components/BlockHeader'
import DeleteConfirmationDialog from '../../components/DeleteConfirmationDialog'
import GroupStepWithAddButton from '../../components/GroupStepWithAddButton'
import { getForEachBlockPreviewParts } from '../../helpers/getConditionBlockPreview'
import useDeleteStepConfirmation from '../../hooks/useDeleteStepConfirmation'
import { HoverAddStepButton } from '../IfThen/HoverAddStepButton'
import IfThen from '../IfThen/IfThen'
import { blockActionButtonStyles, conditionBlockStyles } from '../IfThen/styles'

interface ForEachProps {
  groupedSteps: IStep[][]
  stepsBeforeGroup: IStep[]
}

/**
 * A for-each V2 loop drawn as a REPEAT condition block, picked over
 * `ForEachV1` by `FlowStepGroup`.
 */
export default function ForEach(props: ForEachProps) {
  const { groupedSteps } = props
  const { currentStepId, flow, isDrawerOpen, onDrawerClose, readOnly } =
    useContext(EditorContext)
  const { groupingActions } = useContext(StepsToDisplayContext)
  const { handleReorderUpdate } = useReorderSteps(flow.id)

  const forEachSteps = groupedSteps[0]
  const conditionStep = forEachSteps[0]

  // NOTE: groupedSteps includes for-each and if-then actions
  // so groupedSteps === 1 means that there is only the for-each action
  const nonForEachActionSteps = forEachSteps.filter(
    (step) => step.type === 'action' && step.key !== TOOLBOX_ACTIONS.ForEach,
  )
  const hasNoActionSteps =
    nonForEachActionSteps.length === 0 && groupedSteps.length === 1

  // Every non-condition step in the body shares one reorder domain, matching
  // the top-level list — a plain step immediately next to an if-then V2
  // block must be able to swap with it, not be stuck in a separate list. A
  // block still reorders as one sortable unit; its children only reorder
  // within the block's own SortableList (in IfThen), never into this one.
  const bodySteps = useMemo(() => groupedSteps.flat().slice(1), [groupedSteps])

  const blockItems = useMemo(() => {
    if (bodySteps.length === 0) {
      return []
    }
    return buildStepsList(
      bodySteps,
      groupingActions ?? new Set<string>(),
    ).filter(
      (item): item is IfThenBlock | SingleStep => item.type !== 'forEachBlock',
    )
  }, [bodySteps, groupingActions])

  const hasBlock = blockItems.some((item) => item.type === 'ifThenBlock')

  const sortableItems = useMemo(
    () =>
      blockItems.map((item) => ({
        id: item.type === 'ifThenBlock' ? item.ifThenStep.id : item.step.id,
        item,
      })),
    [blockItems],
  )
  const canReorder = !readOnly && blockItems.length > 1
  const lastItemId = sortableItems[sortableItems.length - 1]?.id

  const handleReorder = async (
    reordered: Array<{ id: string; item: IfThenBlock | SingleStep }>,
  ) => {
    const reorderedSteps = reordered.flatMap(({ item }) =>
      item.type === 'ifThenBlock'
        ? [item.ifThenStep, ...item.children]
        : [item.step],
    )
    const stepPositions = reorderedSteps.map((step, index) => ({
      id: step.id,
      position: conditionStep.position + index + 1,
      type: step.type as StepEnumType,
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

  const {
    cancelRef,
    isOpen: isDeleteConfirmationOpen,
    onClose: closeDeleteConfirmation,
    onDelete: deleteForEach,
    openDeleteConfirmation,
  } = useDeleteStepConfirmation(TOOLBOX_ACTIONS.ForEach, groupedSteps)

  const handleForEachDelete = useCallback(async () => {
    await deleteForEach()
    onDrawerClose()
  }, [deleteForEach, onDrawerClose])

  const isSelected = currentStepId === conditionStep.id

  const previewParts = useMemo(
    () => getForEachBlockPreviewParts(conditionStep.parameters),
    [conditionStep.parameters],
  )

  return (
    <Flex
      {...conditionBlockStyles.container}
      borderWidth="1px"
      borderColor={isSelected ? 'base.content.brand' : 'base.divider.medium'}
    >
      <BlockHeader
        badgeLabel="REPEAT"
        previewParts={previewParts}
        stepId={conditionStep.id}
        isSelected={isSelected}
        actions={
          readOnly ? undefined : (
            <IconButton
              {...blockActionButtonStyles}
              onClick={openDeleteConfirmation}
              aria-label="Delete for each action"
              icon={<BiTrash />}
            />
          )
        }
      />

      <Flex {...conditionBlockStyles.body}>
        {hasNoActionSteps ? (
          <HoverAddStepButton
            isDisabled={readOnly}
            isDrawerOpen={isDrawerOpen}
            isLastStep={true}
            prevStep={conditionStep}
            showEmptyAction={true}
            hideLeadingConnector
            step={conditionStep}
            allowReorder={false}
          />
        ) : (
          <Flex flexDir="column" w="100%" gap={hasBlock ? 2 : undefined}>
            <SortableList
              items={sortableItems}
              onChange={handleReorder}
              renderItem={(sortableItem, isOverlay) => {
                const { id, item } = sortableItem
                const isLastItem = id === lastItemId

                if (item.type === 'ifThenBlock') {
                  return (
                    <SortableList.Item id={id} isOverlay={isOverlay ?? false}>
                      <IfThen
                        block={item}
                        isLastBlock={isLastItem}
                        allowReorder={canReorder}
                      />
                    </SortableList.Item>
                  )
                }

                // A plain step around if-then V2 blocks in the body — an
                // explicit endStepId marker can end a block before the body's
                // last step, unlike a derived if-then V1 extent.
                return (
                  <SortableList.Item id={id} isOverlay={isOverlay ?? false}>
                    <Flex w="100%" flexDir="column">
                      <GroupStepWithAddButton
                        step={item.step}
                        asConditionBlock
                        canAddStep={true}
                        isLastStep={isLastItem}
                        isOverlay={isOverlay}
                        allowReorder={canReorder}
                      />
                    </Flex>
                  </SortableList.Item>
                )
              }}
            />
          </Flex>
        )}
      </Flex>

      <DeleteConfirmationDialog
        name="For each"
        cancelRef={cancelRef}
        isOpen={isDeleteConfirmationOpen}
        onClose={closeDeleteConfirmation}
        onDelete={handleForEachDelete}
        onCancel={closeDeleteConfirmation}
      />
    </Flex>
  )
}
