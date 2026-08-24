import { IStep } from '@plumber/types'

import {
  type MouseEventHandler,
  useCallback,
  useContext,
  useMemo,
  useRef,
} from 'react'
import { BiDuplicate, BiTrash } from 'react-icons/bi'
import { useMutation } from '@apollo/client'
import { Box, Flex, useDisclosure } from '@chakra-ui/react'
import { IconButton } from '@opengovsg/design-system-react'

import UnsavedChangesAlert from '@/components/Editor/components/UnsavedChangesAlert'
import { MIN_FLOW_STEP_WIDTH } from '@/components/Editor/constants'
import {
  type IfThenBlock,
  isBlankPlaceholderStep,
  isStepInsideForEachBody,
} from '@/components/Editor/helpers/steps-utils'
import { NESTED_FLOW_STEP_HEIGHT } from '@/components/FlowStep/styles'
import MenuAlertDialog from '@/components/MenuAlertDialog'
import { SortableList } from '@/components/SortableList'
import { NESTED_DRAG_HANDLE_WIDTH } from '@/components/SortableList/components/SortableItem'
import { EditorContext } from '@/contexts/Editor'
import { StepsToDisplayContext } from '@/contexts/StepsToDisplay'
import { StepEnumType } from '@/graphql/__generated__/graphql'
import { DELETE_STEP } from '@/graphql/mutations/delete-step'
import { GET_FLOW } from '@/graphql/queries/get-flow'
import { getFlowStepHeaderWidth } from '@/helpers/editor'
import useReorderSteps from '@/hooks/useReorderSteps'
import { useUnsavedChanges } from '@/hooks/useUnsavedChanges'

import ConditionBlockHeader from '../../components/ConditionBlockHeader'
import GroupStepWithAddButton from '../../components/GroupStepWithAddButton'
import { getConditionBlockPreviewParts } from '../../helpers/getConditionBlockPreview'

import { AddAfterBlockButton } from './AddAfterBlockButton'
import { HoverAddStepButton } from './HoverAddStepButton'
import { blockActionButtonStyles, conditionBlockStyles } from './styles'
import useDuplicateBranch from './useDuplicateBranch'

interface IfThenProps {
  block: IfThenBlock
  // Whether this block is the last item in the flow, which drives the
  // add-after button's last-step styling.
  isLastBlock: boolean
  // IMPORTANT: only meaningful when the block renders inside a top-level
  // SortableList.Item. That's what gives it a drag handle at all.
  allowReorder?: boolean
}

interface ReorderItem {
  id: string
  step: IStep
  index: number
}

/**
 * A single-branch if-then block: the condition step (the if-then action) plus
 * the steps that run when it passes. An empty block shows the add-first-step
 * placeholder.
 *
 * Drawn as a grey well with an IF badge header. Clicking the header opens the
 * condition drawer — there is no separate condition card or branch-name field.
 * Block-level affordances live in the header (delete / duplicate), beside the
 * box (drag to reorder) and below it (add a step after the block).
 */
export default function IfThen({
  block,
  isLastBlock,
  allowReorder = false,
}: IfThenProps): JSX.Element {
  const { ifThenStep, children } = block
  const {
    currentStepId,
    flow,
    isDrawerOpen,
    isMobile,
    readOnly,
    onDrawerClose,
    setCurrentStepId,
    shouldWarnOnLeave,
  } = useContext(EditorContext)
  const { actionStepsToDisplay, groupingActions } = useContext(
    StepsToDisplayContext,
  )
  const { handleReorderUpdate } = useReorderSteps(flow.id)

  const isEmptyBlock = children.length === 0

  // A not-yet-upgraded if-then V1 block whose only child is the branch
  // initializer's leftover blank placeholder should read as an empty V2
  // block, so the (redundant) hover-+ around that placeholder is suppressed.
  const isSoleBlankPlaceholder =
    children.length === 1 && isBlankPlaceholderStep(children[0])

  // Only true for a for-each body today, letting the block borrow that
  // body's width and connector style instead of the top-level one.
  const isNestedInBlock = isStepInsideForEachBody(
    ifThenStep,
    actionStepsToDisplay,
    groupingActions ?? new Set<string>(),
  )

  const conditionPreviewParts = getConditionBlockPreviewParts(
    ifThenStep.parameters,
  )
  const isSelected = currentStepId === ifThenStep.id

  // IMPORTANT: assumes allowReorder already excludes read-only. The caller
  // (StepsList) folds that in before passing it down.
  const showDragHandle = allowReorder && !isDrawerOpen && !isMobile

  // IMPORTANT: without this, a nested block's box sits off-centre because
  // nothing else absorbs the inline handle's width. Mirrors the offset a
  // reorderable step's own row makes for its own handle.
  const blockHandleOffset =
    isNestedInBlock && showDragHandle ? NESTED_DRAG_HANDLE_WIDTH / 2 : 0

  // Whole-block delete. An explicit if-then V2 block sends just the if-then's
  // id, and the backend expands that to the block's range. An if-then V1
  // block still sends its derived member ids directly.
  const {
    isOpen: deleteConfirmationIsOpen,
    onOpen: openDeleteConfirmationImpl,
    onClose: closeDeleteConfirmation,
  } = useDisclosure()
  const cancelDeleteButton = useRef<HTMLButtonElement>(null)
  const [deleteStep, { loading: isDeletingBlock }] = useMutation(DELETE_STEP, {
    refetchQueries: [GET_FLOW],
  })
  const openDeleteConfirmation = useCallback<MouseEventHandler>(
    (e) => {
      e.stopPropagation()
      openDeleteConfirmationImpl()
    },
    [openDeleteConfirmationImpl],
  )
  const deleteBlock = useCallback(async () => {
    const idsToDelete = block.isExplicit
      ? [ifThenStep.id]
      : [ifThenStep.id, ...children.map((step) => step.id)]
    await deleteStep({
      variables: {
        input: { ids: idsToDelete, flow: { updatedAt: flow.updatedAt } },
      },
    })

    setCurrentStepId(null)
    closeDeleteConfirmation()
    onDrawerClose()
  }, [
    block.isExplicit,
    ifThenStep.id,
    children,
    deleteStep,
    flow.updatedAt,
    setCurrentStepId,
    closeDeleteConfirmation,
    onDrawerClose,
  ])

  // Whole-block duplicate via DUPLICATE_BRANCH, passing the block's steps
  // with endStep as the previous step. The backend re-derives the marker, so
  // none is sent from the client.
  const blockSteps = useMemo(
    () => [ifThenStep, ...children],
    [ifThenStep, children],
  )
  const cancelDuplicateButton = useRef<HTMLButtonElement>(null)
  const {
    canDuplicateBranch,
    duplicateConfirmationIsOpen,
    isDuplicatingBranch,
    closeDuplicateConfirmation,
    duplicateBranch,
    openDuplicateConfirmation,
  } = useDuplicateBranch(blockSteps)

  // We only warn on unsaved changes when duplicating, to ensure the latest
  // changes are saved before the copy is derived.
  const {
    cancelRef,
    isWarningOpen,
    onWarningOpen,
    onWarningClose,
    handleProceed,
    handleLeave: discardChanges,
  } = useUnsavedChanges({
    onProceed: openDuplicateConfirmation,
  })
  const onDuplicate = useCallback(() => {
    if (shouldWarnOnLeave) {
      onWarningOpen()
    } else {
      handleProceed()
    }
  }, [handleProceed, onWarningOpen, shouldWarnOnLeave])

  const handleReorderSteps = async (items: ReorderItem[]) => {
    const stepPositions = items.map((item, index) => ({
      id: item.id,
      position: ifThenStep.position + index + 1,
      type: item.step.type as StepEnumType,
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
    <Flex flexDir="column" w="100%">
      <Flex
        w="100%"
        alignItems="center"
        justifyContent={isDrawerOpen ? 'flex-start' : 'center'}
      >
        <Flex
          pos="relative"
          alignItems="center"
          w={getFlowStepHeaderWidth(isDrawerOpen, isMobile, isNestedInBlock)}
          minW={MIN_FLOW_STEP_WIDTH}
        >
          <Flex
            {...conditionBlockStyles.container}
            display={isMobile ? 'block' : 'flex'}
            // Lets the box give up room to the inline drag handle below
            // instead of overflowing the slot.
            // Replaced by an explicit width and offset when the handle is
            // present (see blockHandleOffset).
            flex={blockHandleOffset ? undefined : '1'}
            // flexShrink 0 keeps the nudge as a real position shift. Default
            // shrink would otherwise claw the margin back out of the box's
            // width.
            flexShrink={blockHandleOffset ? 0 : undefined}
            w={
              blockHandleOffset
                ? `calc(100% - ${NESTED_DRAG_HANDLE_WIDTH}px)`
                : undefined
            }
            ml={blockHandleOffset ? `${blockHandleOffset}px` : undefined}
            minW="0"
            overflow="hidden"
            borderWidth="1px"
            borderColor={
              isSelected ? 'base.content.brand' : 'base.divider.medium'
            }
          >
            <ConditionBlockHeader
              badgeLabel="IF"
              previewParts={conditionPreviewParts}
              stepId={ifThenStep.id}
              isSelected={isSelected}
              actions={
                !readOnly ? (
                  <>
                    {canDuplicateBranch && (
                      <IconButton
                        {...blockActionButtonStyles}
                        onClick={onDuplicate}
                        aria-label="Duplicate if-then"
                        icon={<BiDuplicate />}
                        isLoading={isDuplicatingBranch}
                        isDisabled={isDuplicatingBranch || isDeletingBlock}
                      />
                    )}
                    <IconButton
                      {...blockActionButtonStyles}
                      onClick={openDeleteConfirmation}
                      aria-label="Delete if-then"
                      icon={<BiTrash />}
                      isLoading={isDeletingBlock}
                      isDisabled={isDeletingBlock || isDuplicatingBranch}
                    />
                  </>
                ) : undefined
              }
            />

            {/*
              White content band under the flush grey header. Steps (and the
              empty-state placeholder) live here with their own padding.
            */}
            <Flex {...conditionBlockStyles.body} pb={isEmptyBlock ? 2 : 3}>
              {isEmptyBlock ? (
                <HoverAddStepButton
                  isDisabled={readOnly}
                  isDrawerOpen={isDrawerOpen}
                  isLastStep={true}
                  prevStep={ifThenStep}
                  showEmptyAction={true}
                  hideLeadingConnector
                  step={ifThenStep}
                  allowReorder={false}
                />
              ) : (
                <SortableList
                  items={children.map((step, index) => ({
                    id: step.id,
                    step,
                    index,
                  }))}
                  onChange={handleReorderSteps}
                  renderItem={(item, isOverlay) => {
                    const { step, index } = item
                    const isLastStep = index === children.length - 1

                    return (
                      <SortableList.Item id={item.id}>
                        <Flex w="100%" flexDir="column">
                          <GroupStepWithAddButton
                            step={step}
                            asConditionBlock
                            canAddStep={!isSoleBlankPlaceholder}
                            isLastStep={isLastStep}
                            isOverlay={isOverlay}
                            allowReorder={children.length > 1}
                          />
                        </Flex>
                      </SortableList.Item>
                    )
                  }}
                />
              )}
            </Flex>

            <MenuAlertDialog
              isDialogOpen={deleteConfirmationIsOpen}
              cancelRef={cancelDeleteButton}
              onDialogClose={closeDeleteConfirmation}
              dialogHeader="If-then"
              dialogType="delete"
              onClick={deleteBlock}
              isLoading={isDeletingBlock}
            />

            <MenuAlertDialog
              isDialogOpen={duplicateConfirmationIsOpen}
              cancelRef={cancelDuplicateButton}
              onDialogClose={closeDuplicateConfirmation}
              dialogHeader="If-then"
              dialogType="duplicate-branch"
              onClick={duplicateBranch}
              isLoading={isDuplicatingBranch}
            />

            <UnsavedChangesAlert
              cancelRef={cancelRef}
              isOpen={isWarningOpen}
              onClose={onWarningClose}
              onLeave={discardChanges}
            />
          </Flex>

          {/*
            Sits outside the box so it doesn't crowd the header title.
            Positioned absolutely at the top level so it can't pull the box
            off centre. Nested in a for-each it's laid out as a row sibling
            instead. That slot fills the parent's width, so an
            absolutely-positioned handle would overflow past the for-each's
            edge.
          */}
          {showDragHandle &&
            (isNestedInBlock ? (
              <Flex
                alignItems="center"
                alignSelf="flex-start"
                h={NESTED_FLOW_STEP_HEIGHT}
                flexShrink={0}
              >
                <SortableList.DragHandle isNested />
              </Flex>
            ) : (
              <Box
                pos="absolute"
                left="100%"
                top={0}
                h={NESTED_FLOW_STEP_HEIGHT}
              >
                <Flex alignItems="center" h="100%">
                  <SortableList.DragHandle />
                </Flex>
              </Box>
            ))}
        </Flex>
      </Flex>

      {/*
        The connector down to whatever follows the block, which doubles as the
        affordance for adding a step after the whole block. Same place, height
        and dividers as a plain step's add button relative to its card.
      */}
      <AddAfterBlockButton
        block={block}
        isLastStep={isLastBlock}
        isNested={isNestedInBlock}
      />
    </Flex>
  )
}
