import { IStep } from '@plumber/types'

import {
  Fragment,
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
import { EditorContext } from '@/contexts/Editor'
import { DELETE_STEP } from '@/graphql/mutations/delete-step'
import { GET_FLOW } from '@/graphql/queries/get-flow'
import { useUnsavedChanges } from '@/hooks/useUnsavedChanges'

import { HoverAddStepButton } from './HoverAddStepButton'
import { branchStyles } from './styles'
import useDuplicateBranch from './useDuplicateBranch'
import { allowAddStep } from './utils'

interface BranchProps {
  branchSteps: IStep[]
  stepsBeforeGroup: IStep[]
}

export default function Branch(props: BranchProps) {
  const { branchSteps, stepsBeforeGroup } = props

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
      {branchSteps.map((step, index) => {
        return (
          <Fragment key={`${step.id}-${stepsBeforeGroup.length + index}`}>
            <FlowStep
              step={step}
              isDeletable={index !== 0}
              isNested={true}
              isLastStep={index === branchSteps.length - 1}
            />
            <HoverAddStepButton
              isDisabled={isEditorReadOnly || !canAddStep}
              isDrawerOpen={isDrawerOpen}
              isLastStep={index === branchSteps.length - 1}
              prevStepId={step.id}
            />
          </Fragment>
        )
      })}

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
