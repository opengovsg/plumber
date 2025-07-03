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

import UnsavedChangesAlert from '@/components/Editor/UnsavedChangesAlert'
import FlowStep from '@/components/FlowStep'
import MenuAlertDialog from '@/components/MenuAlertDialog'
import { SortableList } from '@/components/SortableList'
import { EditorContext } from '@/contexts/Editor'
import { DELETE_STEP } from '@/graphql/mutations/delete-step'
import { GET_FLOW } from '@/graphql/queries/get-flow'
import { useUnsavedChanges } from '@/hooks/useUnsavedChanges'

import BranchStepWithAddButton from './BranchStepWithAddButton'
import { HoverAddStepButton } from './HoverAddStepButton'
import { branchStyles } from './styles'
import useDuplicateBranch from './useDuplicateBranch'
import { allowAddStep } from './utils'

interface BranchProps {
  branchSteps: IStep[]
  stepsBeforeGroup: IStep[]
}

export default function Branch(props: BranchProps) {
  const { branchSteps } = props

  const {
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
  const openDeleteConfirmation = useCallback<MouseEventHandler>(
    (e) => {
      e.stopPropagation()
      openDeleteConfirmationImpl()
    },
    [openDeleteConfirmationImpl],
  )
  const deleteBranch = useCallback(async () => {
    const idsToDelete = branchSteps.map((step) => step.id)
    await deleteStep({
      variables: { input: { ids: idsToDelete } },
    })

    setCurrentStepId(null)
    closeDeleteConfirmation()
    onDrawerClose()
  }, [
    branchSteps,
    deleteStep,
    onDrawerClose,
    closeDeleteConfirmation,
    setCurrentStepId,
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

  const handleReorderSteps = async (items: any[]) => {
    const branchPosition = branchSteps[0].position
    const stepPositions = items.map((item, index) => ({
      id: item.id,
      position: branchPosition + index + 1, // index starts at 0
      step: {
        id: item.step.id,
        type: item.step.type,
      },
    }))

    try {
      // TODO: make api call to update step positions
    } catch (error) {
      console.error(
        'Error updating step positions: ',
        error,
        JSON.stringify(stepPositions),
      )
    }
  }

  const { conditionStep, actionSteps } = useMemo(() => {
    const conditionStep = branchSteps[0]
    const actionSteps = branchSteps.slice(1)

    return { conditionStep, actionSteps }
  }, [branchSteps])

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
        <BranchStepWithAddButton
          step={conditionStep}
          canAddStep={canAddStep}
          isLastStep={false}
        />
        <SortableList
          items={actionSteps.map((step, index) => ({
            id: step.id,
            step,
            index,
          }))}
          onChange={handleReorderSteps}
          renderItem={(item, isDragging, isOverlay) => {
            const { step, index } = item

            return (
              <SortableList.Item id={item.id}>
                <Flex w="100%" flexDir="column">
                  <FlowStep
                    step={item.step}
                    isDeletable={true}
                    isLastStep={index === branchSteps.length - 2}
                    isNested={true}
                    allowReorder={branchSteps.length > 2}
                  />
                  {!isOverlay && (
                    <HoverAddStepButton
                      isDisabled={isEditorReadOnly || !canAddStep}
                      isDrawerOpen={isDrawerOpen}
                      isLastStep={index === branchSteps.length - 2}
                      prevStepId={step.id}
                    />
                  )}
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
