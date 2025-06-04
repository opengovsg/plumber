import { IStep } from '@plumber/types'

import {
  Fragment,
  MouseEventHandler,
  useCallback,
  useContext,
  useMemo,
  useRef,
} from 'react'
import { BiTrash } from 'react-icons/bi'
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
import { CREATE_STEP } from '@/graphql/mutations/create-step'
import { DELETE_STEP } from '@/graphql/mutations/delete-step'
import { GET_FLOW } from '@/graphql/queries/get-flow'

import { allowAddStep } from '../utils'

import { HoverAddStepButton } from './HoverAddStepButton'
import { branchStyles } from './styles'

interface BranchProps {
  branchSteps: IStep[]
  stepsBeforeGroup: IStep[]
  groupedSteps: IStep[][]
}

export default function Branch(props: BranchProps) {
  const { branchSteps, stepsBeforeGroup, groupedSteps } = props

  const {
    flow,
    hasForEach,
    isDrawerOpen,
    isMobile,
    readOnly: isEditorReadOnly,
    onDrawerClose,
    setCurrentStepId,
  } = useContext(EditorContext)

  // Handle branch deletion
  const {
    isOpen: deleteConfirmationIsOpen,
    onOpen: openDeleteConfirmationImpl,
    onClose: closeDeleteConfirmation,
  } = useDisclosure()
  const cancelDeleteButton = useRef<HTMLButtonElement>(null)
  const [createStep, { loading: isCreatingStep }] = useMutation(CREATE_STEP, {
    fetchPolicy: 'no-cache',
    refetchQueries: [GET_FLOW],
  })
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

    // EDGE CASE: if the branch is the last step in a for-each action,
    // we should create an empty step after the for-each set up step
    if (
      hasForEach &&
      groupedSteps.length === 1 &&
      stepsBeforeGroup.length === 1
    ) {
      await createStep({
        variables: {
          input: {
            previousStep: { id: stepsBeforeGroup[0]?.id },
            flow: { id: flow.id },
          },
        },
      })
    }

    setCurrentStepId(null)
    closeDeleteConfirmation()
    onDrawerClose()
  }, [
    branchSteps,
    deleteStep,
    hasForEach,
    groupedSteps.length,
    stepsBeforeGroup,
    setCurrentStepId,
    closeDeleteConfirmation,
    onDrawerClose,
    createStep,
    flow.id,
  ])

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
                  openDeleteConfirmation(event)
                  event.stopPropagation()
                }}
                variant="clear"
                aria-label="Delete branch"
                colorScheme="secondary"
                icon={<BiTrash />}
                isLoading={isDeletingBranch || isCreatingStep}
                isDisabled={isDeletingBranch || isCreatingStep}
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
