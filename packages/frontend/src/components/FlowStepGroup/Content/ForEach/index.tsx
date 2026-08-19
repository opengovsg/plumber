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
import { FlowStepGroup } from '@/exports/components'
import { StepEnumType } from '@/graphql/__generated__/graphql'
import { TOOLBOX_ACTIONS } from '@/helpers/toolbox'
import { useIfThenV2Enabled } from '@/hooks/useIfThenV2Enabled'
import useReorderSteps from '@/hooks/useReorderSteps'

import ConditionBlockHeader from '../../components/ConditionBlockHeader'
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

export default function ForEach(props: ForEachProps) {
  const { groupedSteps } = props
  const { currentStepId, flow, isDrawerOpen, onDrawerClose, readOnly } =
    useContext(EditorContext)
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

  // Every non-condition step in the body shares one reorder domain, matching
  // the top-level list — a plain step immediately next to an if-then V2
  // block must be able to swap with it, not be stuck in a separate list. A
  // block still reorders as one sortable unit; its children only reorder
  // within the block's own SortableList (in IfThen), never into this one.
  const bodySteps = useMemo(() => groupedSteps.flat().slice(1), [groupedSteps])

  const ifThenBlockItems = useMemo(() => {
    if (!isIfThenV2Enabled || bodySteps.length === 0) {
      return []
    }
    return buildStepsList(
      bodySteps,
      groupingActions ?? new Set<string>(),
    ).filter(
      (item): item is IfThenBlock | SingleStep => item.type !== 'forEachBlock',
    )
  }, [isIfThenV2Enabled, bodySteps, groupingActions])

  const hasIfThenBlockItem = ifThenBlockItems.some(
    (item) => item.type === 'ifThenBlock',
  )

  const sortableBlockItems = useMemo(
    () =>
      ifThenBlockItems.map((item) => ({
        id: item.type === 'ifThenBlock' ? item.ifThenStep.id : item.step.id,
        item,
      })),
    [ifThenBlockItems],
  )
  const canReorderBlocks = !readOnly && ifThenBlockItems.length > 1
  const lastBlockItemId = sortableBlockItems[sortableBlockItems.length - 1]?.id

  const handleReorderBlockItems = async (
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

  // V1 keeps the loop's own chrome — and its delete button — in FlowStepGroup,
  // so only the V2 header below wires up a delete of its own. Both go away
  // together when the flag retires and FlowStepGroup stops wrapping for-each.
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

  // V1: the loop's condition renders as a card of its own, inside the
  // app-icon-and-caption box FlowStepGroup draws around this component.
  if (!isIfThenV2Enabled) {
    return (
      <Flex flexDir="column" alignItems="center" borderRadius="lg" w="100%">
        <Flex flexDir="column" w="100%" px={4} py={3}>
          <GroupStepWithAddButton
            step={conditionStep}
            canAddStep={true}
            isLastStep={hasNoActionSteps}
            allowReorder={false}
            showEmptyAction={hasNoActionSteps}
            // True when either sibling list has a reorderable item, so the
            // header still reserves width for that item's drag handle.
            canChildStepsReorder={actionSteps.length > 1 || canReorderBlocks}
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

          {ifThenSteps.length > 0 && !isIfThenV2Loading && (
            <FlowStepGroup
              stepsBeforeGroup={forEachSteps}
              groupedSteps={ifThenSteps}
            />
          )}
        </Flex>
      </Flex>
    )
  }

  // V2: a REPEAT badge plus the plain-language list preview stand in for the
  // condition step, so the loop reads as one sentence rather than a captioned
  // box wrapping a card. Matches how IfThen draws a V2 block.
  const isSelected = currentStepId === conditionStep.id

  return (
    <Flex
      {...conditionBlockStyles.container}
      borderWidth="1px"
      borderColor={isSelected ? 'base.content.brand' : 'base.divider.medium'}
    >
      <ConditionBlockHeader
        badgeLabel="REPEAT"
        previewParts={getForEachBlockPreviewParts(conditionStep.parameters)}
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
          <Flex
            flexDir="column"
            w="100%"
            gap={hasIfThenBlockItem ? 2 : undefined}
          >
            <SortableList
              items={sortableBlockItems}
              onChange={handleReorderBlockItems}
              renderItem={(sortableItem, isOverlay) => {
                const { id, item } = sortableItem
                const isLastItem = id === lastBlockItemId

                if (item.type === 'ifThenBlock') {
                  return (
                    <SortableList.Item id={id} isOverlay={isOverlay ?? false}>
                      <IfThen
                        block={item}
                        isLastBlock={isLastItem}
                        allowReorder={canReorderBlocks}
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
                        allowReorder={canReorderBlocks}
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
