import { IStep } from '@plumber/types'

import { Fragment, useCallback, useContext, useMemo } from 'react'
import { BiTrash } from 'react-icons/bi'
import { Box, Flex, Text } from '@chakra-ui/react'
import { IconButton } from '@opengovsg/design-system-react'

import FlowStep from '@/components/FlowStep'
import { EditorContext } from '@/contexts/Editor'
import { TOOLBOX_ACTIONS } from '@/helpers/toolbox'

import DeleteConfirmationDialog from '../../components/DeleteConfirmationDialog'
import useDeleteStepConfirmation from '../../hooks/useDeleteStepConfirmation'
import { allowAddStep } from '../utils'

import { HoverAddStepButton } from './HoverAddStepButton'
import { branchStyles } from './styles'

interface BranchProps {
  branchSteps: IStep[]
  stepsBeforeGroup: IStep[]
  groupedSteps: IStep[][]
}

export default function Branch(props: BranchProps) {
  const { branchSteps, groupedSteps, stepsBeforeGroup } = props

  const {
    isDrawerOpen,
    isMobile,
    readOnly: isEditorReadOnly,
    onDrawerClose,
    setCurrentStepId,
  } = useContext(EditorContext)

  // Handle branch deletion
  const {
    isDeletingBranch,
    isOpen: isDeleteConfirmationOpen,
    onOpen: openDeleteConfirmation,
    onClose: closeDeleteConfirmation,
    onDelete: deleteBranch,
    cancelRef,
  } = useDeleteStepConfirmation(
    TOOLBOX_ACTIONS.IfThen,
    groupedSteps,
    branchSteps,
  )

  const handleDeleteBranch = useCallback(async () => {
    await deleteBranch()

    setCurrentStepId(null)
    closeDeleteConfirmation()
    onDrawerClose()
  }, [deleteBranch, setCurrentStepId, closeDeleteConfirmation, onDrawerClose])

  const canAddStep = useMemo(() => allowAddStep(branchSteps), [branchSteps])

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

          {/* Delete branch button */}
          {!isEditorReadOnly && (
            <Flex ml="auto" opacity={0} _groupHover={{ opacity: 1 }}>
              <IconButton
                boxSize={8}
                onClick={(event) => {
                  openDeleteConfirmation()
                  event.stopPropagation()
                }}
                variant="clear"
                aria-label="Delete branch"
                colorScheme="secondary"
                icon={<BiTrash />}
                isLoading={isDeletingBranch}
                isDisabled={isDeletingBranch}
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
              index={stepsBeforeGroup.length + index}
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
      <DeleteConfirmationDialog
        name={branchSteps[0].parameters.branchName as string}
        cancelRef={cancelRef}
        isOpen={isDeleteConfirmationOpen}
        onClose={closeDeleteConfirmation}
        onDelete={handleDeleteBranch}
        onCancel={closeDeleteConfirmation}
      />
    </Flex>
  )
}
