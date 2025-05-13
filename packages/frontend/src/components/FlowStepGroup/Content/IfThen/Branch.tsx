import { IStep } from '@plumber/types'

import {
  Fragment,
  MouseEventHandler,
  useCallback,
  useContext,
  useRef,
} from 'react'
import { BiTrashAlt } from 'react-icons/bi'
import { useMutation } from '@apollo/client'
import {
  AlertDialog,
  AlertDialogBody,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogOverlay,
  Box,
  Button,
  Flex,
  Text,
  useDisclosure,
} from '@chakra-ui/react'
import { IconButton } from '@opengovsg/design-system-react'

import FlowStep from '@/components/FlowStep'
import { EditorContext } from '@/contexts/Editor'
import { DELETE_STEP } from '@/graphql/mutations/delete-step'
import { GET_FLOW } from '@/graphql/queries/get-flow'
import { TOOLBOX_ACTIONS } from '@/helpers/toolbox'

import { HoverAddStepButton } from './HoverAddStepButton'
import { branchStyles } from './styles'

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
    onDrawerOpen,
    setCurrentStepId,
    setCurrentStepIndex,
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

    // prevents accordion from collapsing when deleting the first branch
    const ifThenRemaining = branchSteps
      .filter(
        (step) =>
          step.key === TOOLBOX_ACTIONS.IfThen && !idsToDelete.includes(step.id),
      )
      .map((step) => step.id)
    if (ifThenRemaining.length > 0) {
      setCurrentStepId(ifThenRemaining[0])
    }
    closeDeleteConfirmation()
    onDrawerClose()
  }, [
    branchSteps,
    deleteStep,
    onDrawerClose,
    closeDeleteConfirmation,
    setCurrentStepId,
  ])

  return (
    <Flex key={branchSteps[0].id} {...branchStyles.container}>
      <Box
        borderWidth="1px"
        border="none"
        p={0}
        bg="white"
        overflow="hidden"
        w={isDrawerOpen ? (isMobile ? '0px' : '100%') : '100%'}
        mb={2}
        role="group"
      >
        <Flex alignItems="center" borderRadius="inherit" w="full">
          {/* Branch name */}
          <Text textStyle="subhead-1" color="base.content.default">
            {branchSteps[0].parameters.branchName as string}
          </Text>

          {/* Delete branch button */}
          {!isEditorReadOnly && (
            <Flex ml="auto" opacity={0} _groupHover={{ opacity: 1 }}>
              <IconButton
                boxSize={8}
                onClick={(event) => {
                  openDeleteConfirmation(event)
                  event.stopPropagation()
                }}
                variant="clear"
                aria-label="Delete branch"
                colorScheme="secondary"
                icon={<BiTrashAlt />}
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
              isDeletable={index !== 0}
              isNested={true}
              isLastStep={index === branchSteps.length - 1}
              onOpen={() => {
                setCurrentStepId(step.id)
                setCurrentStepIndex(stepsBeforeGroup.length + index)
                onDrawerOpen()
              }}
              onClose={() => {
                setCurrentStepId(null)
                setCurrentStepIndex(null)
                onDrawerClose()
              }}
            />
            <HoverAddStepButton
              isDisabled={isEditorReadOnly}
              isDrawerOpen={isDrawerOpen}
              isLastStep={index === branchSteps.length - 1}
              prevStepId={step.id}
            />
          </Fragment>
        )
      })}

      {/* Delete Confirmation Modal */}
      <AlertDialog
        isOpen={deleteConfirmationIsOpen}
        leastDestructiveRef={cancelDeleteButton}
        onClose={closeDeleteConfirmation}
      >
        <AlertDialogOverlay>
          <AlertDialogContent>
            <AlertDialogHeader>
              Delete {branchSteps[0].parameters.branchName as string}
            </AlertDialogHeader>
            <AlertDialogBody>
              Are you sure you want to delete this branch? This action cannot be
              undone.
            </AlertDialogBody>
            <AlertDialogFooter>
              <Button
                colorScheme="neutral"
                variant="clear"
                ref={cancelDeleteButton}
                onClick={closeDeleteConfirmation}
              >
                Cancel
              </Button>
              <Button colorScheme="critical" onClick={deleteBranch} ml={3}>
                Yes, delete branch
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialogOverlay>
      </AlertDialog>
    </Flex>
  )
}
