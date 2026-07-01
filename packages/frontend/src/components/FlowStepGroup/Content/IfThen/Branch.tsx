import { IStep } from '@plumber/types'

import {
  MouseEventHandler,
  useCallback,
  useContext,
  useMemo,
  useRef,
} from 'react'
import { BiDuplicate, BiTrash } from 'react-icons/bi'
import { useMutation } from '@apollo/client'
import { Box, Flex, Text, useDisclosure } from '@chakra-ui/react'
import { IconButton } from '@opengovsg/design-system-react'

import UnsavedChangesAlert from '@/components/Editor/components/UnsavedChangesAlert'
import MenuAlertDialog from '@/components/MenuAlertDialog'
import { SortableList } from '@/components/SortableList'
import { EditorContext } from '@/contexts/Editor'
import { StepEnumType } from '@/graphql/__generated__/graphql'
import { DELETE_STEP } from '@/graphql/mutations/delete-step'
import { UPDATE_STEP_POSITIONS } from '@/graphql/mutations/update-step-positions'
import { GET_FLOW } from '@/graphql/queries/get-flow'
import useReorderSteps from '@/hooks/useReorderSteps'
import { useUnsavedChanges } from '@/hooks/useUnsavedChanges'

import GroupStepWithAddButton from '../../components/GroupStepWithAddButton'
import { allowAddStep } from '../utils'

import { branchStyles } from './styles'
import useDuplicateBranch from './useDuplicateBranch'

interface BranchProps {
  branchSteps: IStep[]
  stepsBeforeGroup: IStep[]
  // The if-then step of the branch immediately before this one in the block, or
  // undefined for the first branch. Used to maintain the stepIdToJumpTo chain on
  // deletion: the predecessor inherits this branch's step to jump to.
  previousBranchStep?: IStep
}

export default function Branch(props: BranchProps) {
  const { branchSteps, previousBranchStep } = props

  const {
    flow,
    isDrawerOpen,
    isMobile,
    readOnly: isEditorReadOnly,
    onDrawerClose,
    setCurrentStepId,
    shouldWarnOnLeave,
  } = useContext(EditorContext)

  // Handle branch deletion
  const {
    isOpen: deleteConfirmationIsOpen,
    onOpen: openDeleteConfirmationImpl,
    onClose: closeDeleteConfirmation,
  } = useDisclosure()
  const cancelDeleteButton = useRef<HTMLButtonElement>(null)
  const [deleteStep, { loading: isDeletingBranch }] = useMutation(DELETE_STEP, {
    refetchQueries: [GET_FLOW],
  })
  const [updateStepPositions] = useMutation(UPDATE_STEP_POSITIONS)
  const { handleReorderUpdate } = useReorderSteps(flow.id)
  const openDeleteConfirmation = useCallback<MouseEventHandler>(
    (e) => {
      e.stopPropagation()
      openDeleteConfirmationImpl()
    },
    [openDeleteConfirmationImpl],
  )
  const deleteBranch = useCallback(async () => {
    const idsToDelete = branchSteps.map((step) => step.id)

    // The predecessor branch inherits this branch's step to jump to so the
    // chain skips the gap left by the deletion. Skip when there's no predecessor
    // (deleting the first branch — nothing points to it) or when this is a
    // legacy branch with no stored step to jump to (the execution scan handles
    // those) — a branch is new-style iff parameters has the stepIdToJumpTo key.
    const deletionParams = branchSteps[0].parameters
    let updatedAt = flow.updatedAt
    if (
      previousBranchStep &&
      deletionParams &&
      Object.hasOwn(deletionParams, 'stepIdToJumpTo')
    ) {
      const deletedTarget = deletionParams.stepIdToJumpTo as string | null
      const updatedPositions = await updateStepPositions({
        variables: {
          input: {
            stepPositions: [
              {
                id: previousBranchStep.id,
                position: previousBranchStep.position,
                type: previousBranchStep.type as StepEnumType,
                stepIdToJumpTo: deletedTarget,
              },
            ],
            flow: { updatedAt },
          },
        },
      })
      updatedAt =
        updatedPositions.data?.updateStepPositions?.updatedAt ?? updatedAt
    }

    await deleteStep({
      variables: {
        input: { ids: idsToDelete, flow: { updatedAt } },
      },
    })

    setCurrentStepId(null)
    closeDeleteConfirmation()
    onDrawerClose()
  }, [
    branchSteps,
    previousBranchStep,
    updateStepPositions,
    deleteStep,
    onDrawerClose,
    closeDeleteConfirmation,
    setCurrentStepId,
    flow.updatedAt,
  ])

  const canAddStep = useMemo(() => allowAddStep(branchSteps), [branchSteps])

  // Handle duplicate branch
  // we only warn on unsaved changes when duplicating branch to ensure that the
  // latest changes are saved before
  const cancelDuplicateButton = useRef<HTMLButtonElement>(null)
  const {
    canDuplicateBranch,
    duplicateConfirmationIsOpen,
    isDuplicatingBranch,
    closeDuplicateConfirmation,
    duplicateBranch,
    openDuplicateConfirmation,
  } = useDuplicateBranch(branchSteps)

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

  const onLeave = () => {
    discardChanges()
  }

  const { conditionStep, actionSteps } = useMemo(() => {
    const conditionStep = branchSteps[0]
    const actionSteps = branchSteps.slice(1)

    return { conditionStep, actionSteps }
  }, [branchSteps])

  const handleReorderSteps = async (items: any[]) => {
    const branchPosition = conditionStep.position
    const stepPositions = items.map((item, index) => ({
      id: item.id,
      position: branchPosition + index + 1, // index is 0-based
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
    <Flex key={branchSteps[0].id} {...branchStyles.container}>
      <Box
        borderWidth="1px"
        border="none"
        p={0}
        overflow="hidden"
        w={isDrawerOpen ? (isMobile ? '0px' : '100%') : '100%'}
        mb={2}
        role="group"
      >
        <Flex alignItems="center" borderRadius="inherit" w="full" h={8}>
          {/* Branch name */}
          <Text
            textStyle="subhead-1"
            color="base.content.default"
            noOfLines={1}
          >
            {branchSteps[0].parameters.branchName as string}
          </Text>

          {/* Duplicate/delete branch buttons */}
          {!isEditorReadOnly && (
            <Flex
              ml="auto"
              opacity={{ base: 1, lg: 0 }}
              _groupHover={{ opacity: 1 }}
            >
              {canDuplicateBranch && (
                <IconButton
                  boxSize={8}
                  onClick={onDuplicate}
                  variant="clear"
                  aria-label="Duplicate branch"
                  colorScheme="secondary"
                  icon={<BiDuplicate />}
                  isLoading={isDuplicatingBranch}
                  isDisabled={isDuplicatingBranch || isDeletingBranch}
                />
              )}
              <IconButton
                boxSize={8}
                onClick={openDeleteConfirmation}
                variant="clear"
                aria-label="Delete branch"
                colorScheme="secondary"
                icon={<BiTrash />}
                isLoading={isDeletingBranch}
                isDisabled={isDeletingBranch || isDuplicatingBranch}
              />
            </Flex>
          )}
        </Flex>
      </Box>
      <Flex w="100%" flexDir="column">
        <GroupStepWithAddButton
          step={conditionStep}
          canAddStep={canAddStep}
          isLastStep={false}
          allowReorder={false}
          canChildStepsReorder={actionSteps.length > 1}
        />
        <SortableList
          items={actionSteps.map((step, index) => ({
            id: step.id,
            step,
            // need to use index because the step position will
            // not be enough to identify if its the last step
            index,
          }))}
          onChange={handleReorderSteps}
          renderItem={(item, isOverlay) => {
            const { step, index } = item
            const isLastStep = index === actionSteps.length - 1 // index is 0-based

            return (
              <SortableList.Item id={item.id}>
                <Flex w="100%" flexDir="column">
                  <GroupStepWithAddButton
                    step={step}
                    canAddStep={canAddStep}
                    isLastStep={isLastStep}
                    isOverlay={isOverlay}
                    allowReorder={actionSteps.length > 1}
                  />
                </Flex>
              </SortableList.Item>
            )
          }}
        />
      </Flex>

      {/* Delete Confirmation Modal */}
      <MenuAlertDialog
        isDialogOpen={deleteConfirmationIsOpen}
        cancelRef={cancelDeleteButton}
        onDialogClose={closeDeleteConfirmation}
        dialogHeader="Branch"
        dialogType="delete"
        onClick={deleteBranch}
        isLoading={isDeletingBranch}
      />

      {/* Duplicate Confirmation Modal */}
      <MenuAlertDialog
        isDialogOpen={duplicateConfirmationIsOpen}
        cancelRef={cancelDuplicateButton}
        onDialogClose={closeDuplicateConfirmation}
        dialogHeader="Branch"
        dialogType="duplicate-branch"
        onClick={duplicateBranch}
        isLoading={isDuplicatingBranch}
      />

      {/* Unsaved Changes Alert */}
      <UnsavedChangesAlert
        cancelRef={cancelRef}
        isOpen={isWarningOpen}
        onClose={onWarningClose}
        onLeave={onLeave}
      />
    </Flex>
  )
}
