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
import { Box, Divider, Flex, useDisclosure } from '@chakra-ui/react'
import { IconButton } from '@opengovsg/design-system-react'

import UnsavedChangesAlert from '@/components/Editor/components/UnsavedChangesAlert'
import { MIN_FLOW_STEP_WIDTH } from '@/components/Editor/constants'
import {
  type IfThenBlock,
  isBlankPlaceholderStep,
} from '@/components/Editor/helpers/steps-utils'
import { NESTED_FLOW_STEP_HEIGHT } from '@/components/FlowStep/styles'
import MenuAlertDialog from '@/components/MenuAlertDialog'
import { SortableList } from '@/components/SortableList'
import { EditorContext } from '@/contexts/Editor'
import { FlowStep } from '@/exports/components'
import { StepEnumType } from '@/graphql/__generated__/graphql'
import { DELETE_STEP } from '@/graphql/mutations/delete-step'
import { GET_FLOW } from '@/graphql/queries/get-flow'
import { getFlowStepHeaderWidth } from '@/helpers/editor'
import useReorderSteps from '@/hooks/useReorderSteps'
import { useUnsavedChanges } from '@/hooks/useUnsavedChanges'

import GroupStepWithAddButton from '../../components/GroupStepWithAddButton'
import { flowStepGroupStyles } from '../../styles'

import { HoverAddStepButton } from './HoverAddStepButton'
import { blockActionButtonStyles, branchStyles } from './styles'
import useDuplicateBranch from './useDuplicateBranch'

interface IfThenProps {
  block: IfThenBlock
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
 * Drawn as the same grouped box as an if-then V1 group, despite having only
 * one branch, so the two variants read as the same thing in the editor.
 *
 * The interior reuses the shared display building blocks, so a step's own
 * add/reorder affordances behave exactly as they do elsewhere in the editor.
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
  const { handleReorderUpdate } = useReorderSteps(flow.id)

  const isEmptyBlock = children.length === 0

  // A not-yet-upgraded if-then V1 block whose only child is the branch
  // initializer's leftover blank placeholder should read as an empty V2
  // block, so the (redundant) hover-+ around that placeholder is suppressed.
  const isSoleBlankPlaceholder =
    children.length === 1 && isBlankPlaceholderStep(children[0])

  // The single-branch box merges what an if-then V1 group shows as two lines
  // (its own caption, plus the branch name inside it) into one header. A
  // user-renamed step takes priority, as it would for any step. Otherwise the
  // branch name stands in, captioned as an if-then so it doesn't read as a
  // name the user chose themselves.
  const stepName = ifThenStep.config?.stepName
  const branchName = ifThenStep.parameters?.branchName as string | undefined
  const headerLabel =
    stepName ?? (branchName ? `If-then: ${branchName}` : 'If-then')

  // IMPORTANT: assumes allowReorder already excludes read-only. The caller
  // (StepsList) folds that in before passing it down.
  const showDragHandle = allowReorder && !isDrawerOpen && !isMobile

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
          w={getFlowStepHeaderWidth(isDrawerOpen, isMobile)}
          minW={MIN_FLOW_STEP_WIDTH}
        >
          <Flex
            {...flowStepGroupStyles.container}
            display={isMobile ? 'block' : 'flex'}
            w="100%"
            // The header and branch run edge to edge, so the box clips them to
            // its own rounded corners.
            overflow="hidden"
            // The box carries the selected-state border its flush header drops.
            borderColor={
              currentStepId === ifThenStep.id
                ? 'base.content.brand'
                : 'base.divider.medium'
            }
          >
            {/*
              The header stands in for the whole block, not a step of its own to
              configure. So it takes the block's name and drops click-to-configure
              and its own border, letting the box read as one step rather than a
              card holding cards.

              Delete/duplicate are overlaid on the header's trailing edge
              instead of laid out beside it, since hidden-until-hover buttons
              would otherwise reserve width and pull the header in. They're
              siblings of the header rather than children, so a click on them
              never bubbles into the condition card's open-the-drawer handler.

              Being overlaid means they sit outside the header's own padding, so
              they re-create a step's trailing inset and button metrics
              themselves (see FlowStep's header) to line up with the delete icon
              of the steps above and below the block.
            */}
            <Flex alignItems="center" w="100%" role="group" pos="relative">
              <FlowStep
                step={ifThenStep}
                stepNameOverride={headerLabel}
                isContainerHeader
                isClickable={false}
                isNested={true}
                isLastStep={isEmptyBlock}
                allowReorder={false}
              />

              {!readOnly && (
                <Flex
                  pos="absolute"
                  top={0}
                  bottom={0}
                  // The inset and gap a step's header gives its own
                  // duplicate/delete pair. Insetting the overlay rather than
                  // padding it keeps the strip beside the buttons part of the
                  // header, so clicking there still opens the drawer.
                  right={4}
                  gap={1}
                  alignItems="center"
                  opacity={{ base: 1, lg: 0 }}
                  _groupHover={{ opacity: 1 }}
                >
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
                </Flex>
              )}
            </Flex>

            {/*
              The condition step renders again here as a normal card, matching
              how an if-then V1 branch draws its condition card and steps in one
              panel. An empty block keeps this panel and placeholder rather than
              looking like a different component.

              The panel is white, not branchStyles.container's usual grey, since
              a single-branch box doesn't need to visually separate branches the
              way an if-then V1 group's side-by-side branches do.
            */}
            <Flex
              {...branchStyles.container}
              bg="white"
              borderRadius="none"
              // pb drops by the placeholder's own 4px bottom margin so the
              // empty-block panel stays evenly padded overall.
              pb={isEmptyBlock ? 2 : 3}
            >
              <Flex w="100%" flexDir="column">
                {/*
                  This is the same condition step the header above renders, now
                  as a normal, clickable card. It drops its own name and
                  position number since the header already carries both.
                */}
                <FlowStep
                  step={ifThenStep}
                  stepNameOverride="Condition"
                  hideDisplayPosition
                  isNested={true}
                  isLastStep={false}
                  allowReorder={false}
                  // Matches the width sibling cards give up for their own drag
                  // handles, exactly as an if-then V1 branch's condition card
                  // does, so the condition card isn't wider than the cards
                  // below it.
                  canChildStepsReorder={children.length > 1}
                />

                {isEmptyBlock ? (
                  // The placeholder card is `w="100%"`, which only resolves to the
                  // panel's width because this column stretches it; left to the
                  // block box, whose items are centred, it would shrink to fit its
                  // own text.
                  <HoverAddStepButton
                    isDisabled={readOnly}
                    isDrawerOpen={isDrawerOpen}
                    isLastStep={true}
                    prevStep={ifThenStep}
                    showEmptyAction={true}
                    step={ifThenStep}
                    allowReorder={false}
                  />
                ) : (
                  <>
                    {/*
                      Every other card-to-card transition in this panel has a
                      connector; the condition card is no exception, so a
                      populated block can insert a step directly after it too.
                    */}
                    <HoverAddStepButton
                      // Reuses isDisabled for the sole-blank-placeholder edge
                      // case (see isSoleBlankPlaceholder). pointerEvents: none
                      // keeps the connector but makes the hover-+ itself inert.
                      isDisabled={readOnly || isSoleBlankPlaceholder}
                      isDrawerOpen={isDrawerOpen}
                      isLastStep={false}
                      prevStep={ifThenStep}
                      step={ifThenStep}
                      allowReorder={false}
                      canChildStepsReorder={children.length > 1}
                    />
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

                        // Every step, last one included, gets the same hover +
                        // to append after it — matching how a for-each body
                        // (and an if-then V1 branch) appends, rather than the
                        // last step handing off to its own separate,
                        // always-visible "Add step" card.
                        return (
                          <SortableList.Item id={item.id}>
                            <Flex w="100%" flexDir="column">
                              <GroupStepWithAddButton
                                step={step}
                                // Same sole-blank-placeholder edge case as
                                // the leading HoverAddStepButton above: no
                                // trailing hover-+ after it either, so the
                                // card reads as an empty block's own
                                // add-first-step placeholder rather than a
                                // populated block's last member.
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
                  </>
                )}
              </Flex>
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
            Positioned outside the box (not laid out inside the header)
            because the box clips overflow, and an inline handle here would
            eat into the header's title.
          */}
          {showDragHandle && (
            <Box pos="absolute" left="100%" top={0} h={NESTED_FLOW_STEP_HEIGHT}>
              <Flex alignItems="center" h="100%">
                <SortableList.DragHandle />
              </Flex>
            </Box>
          )}
        </Flex>
      </Flex>

      {/*
        Matches the height AddStepButton draws between two steps: 16+36+16px
        normally, or a 48px divider in the stronger colour once read-only
        hides the button. The block has no add-after affordance of its own
        yet, so it draws a plain line of the same height instead. The last
        block draws nothing, matching how a last step has no connector.
      */}
      {!isLastBlock && (
        <Flex flexDir="column" alignItems="center" w="100%">
          {readOnly ? (
            <Divider
              h="48px"
              orientation="vertical"
              borderColor="base.divider.strong"
            />
          ) : (
            <Divider h="68px" orientation="vertical" />
          )}
        </Flex>
      )}
    </Flex>
  )
}
