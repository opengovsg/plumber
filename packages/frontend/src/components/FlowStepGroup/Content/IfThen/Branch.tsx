import { type IFlow, type IStep } from '@plumber/types'

import {
  type MouseEventHandler,
  useCallback,
  useContext,
  useMemo,
  useRef,
} from 'react'
import { BiSolidCheckCircle, BiTrashAlt } from 'react-icons/bi'
import { useMutation } from '@apollo/client'
import {
  AlertDialog,
  AlertDialogBody,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogOverlay,
  Flex,
  Icon,
  Text,
  useDisclosure,
} from '@chakra-ui/react'
import { Button, IconButton, Spinner } from '@opengovsg/design-system-react'
import NestedEditor from 'components/FlowStepGroup/NestedEditor'
import { EditorContext } from 'contexts/Editor'
import {
  type StepDisplayOverridesContextData,
  StepDisplayOverridesProvider,
} from 'contexts/StepDisplayOverrides'
import { DELETE_STEP } from 'graphql/mutations/delete-step'
import { UPDATE_STEP } from 'graphql/mutations/update-step'
import { GET_FLOW } from 'graphql/queries/get-flow'
import { isIfThenBranchCompleted } from 'helpers/toolbelt'

import { BranchContext } from './BranchContext'

interface BranchProps {
  flow: IFlow
  steps: IStep[]
}

export default function Branch(props: BranchProps): JSX.Element {
  const { flow, steps } = props
  const {
    isOpen: editorIsOpen,
    onOpen: openEditor,
    onClose: closeEditor,
  } = useDisclosure()
  const { depth } = useContext(BranchContext)
  const { readOnly: isEditorReadOnly } = useContext(EditorContext)

  const initialStep = steps[0]
  const initialStepDisplayOverride = useMemo<StepDisplayOverridesContextData>(
    () => ({
      [initialStep.id]: {
        hintAboveCaption: 'If... Then',
        // Only the 1st branch can have an undefined name.
        caption: (initialStep.parameters.branchName as string) ?? 'Branch 1',
        disableActionChanges: true,
        disableDelete: true,
      },
    }),
    [initialStep.id, initialStep.parameters.branchName],
  )
  const isCompleted = useMemo(() => isIfThenBranchCompleted(steps), [steps])

  //
  // Handle branch deletion
  //
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
    await deleteStep({
      variables: { input: { ids: steps.map((step) => step.id) } },
    })
    closeDeleteConfirmation()
  }, [deleteStep, steps])

  //
  // ** EDGE CASE **
  //
  // The 1st step of a branch series can have undefined depth if the user has
  // just chosen "If... Then" via the "Choose app & event" substep. However, our
  // back end cannot have undefined depth. Luckily, we know that the user _must_
  // open the branch editor to test any steps within it; thus, we
  // opportunistically set the depth when the user does this.
  //
  // We do this instead of relying on other mechanisms like useEffect (even more
  // clunk) or handling undefined depth in backend (super complex; needs
  // additional callbacks or 300+ LoC)
  //
  const [updateStep, { loading: isUpdatingBranch }] = useMutation(UPDATE_STEP, {
    refetchQueries: [GET_FLOW],
  })
  const onOpenBranch = useCallback(async () => {
    if (isUpdatingBranch) {
      return
    }

    const storedDepth = parseInt(initialStep.parameters.depth as string)

    if (!isNaN(storedDepth)) {
      openEditor()
      return
    }

    await updateStep({
      variables: {
        input: {
          id: initialStep.id,
          appKey: initialStep.appKey,
          key: initialStep.key,
          flow: {
            id: flow.id,
          },
          parameters: {
            ...initialStep.parameters,
            branchName: 'Branch 1',
            depth,
          },
          connection: {
            id: null,
          },
        },
      },
    })
    openEditor()
  }, [openEditor, depth, flow, initialStep])

  return (
    <>
      {/*
       * Branch row
       */}
      <Flex
        onClick={onOpenBranch}
        h={16}
        w="full"
        alignItems="center"
        px={4}
        _hover={{ bg: 'interaction.muted.main.hover', cursor: 'pointer' }}
        _active={{ bg: 'interaction.muted.main.active' }}
      >
        {isUpdatingBranch ? (
          <Spinner />
        ) : (
          <>
            <Text textStyle="subhead-1">
              {(steps[0].parameters.branchName as string | undefined) ??
                'Branch 1'}
            </Text>
            {isCompleted && (
              <Icon
                ml={1}
                boxSize={4}
                color="interaction.success.default"
                as={BiSolidCheckCircle}
              />
            )}
            <IconButton
              onClick={openDeleteConfirmation}
              variant="clear"
              aria-label="Delete Branch"
              icon={<BiTrashAlt />}
              isLoading={isDeletingBranch}
              isDisabled={isEditorReadOnly}
              ml="auto"
            />
          </>
        )}
      </Flex>
      {/*
       * Delete Confirmation Modal
       */}
      <AlertDialog
        isOpen={deleteConfirmationIsOpen}
        leastDestructiveRef={cancelDeleteButton}
        onClose={closeDeleteConfirmation}
      >
        <AlertDialogOverlay>
          <AlertDialogContent>
            <AlertDialogHeader>Delete Branch</AlertDialogHeader>
            <AlertDialogBody>
              Are you sure?{' '}
              {steps.length > 1 &&
                `You will delete all ${steps.length} steps in the branch!`}{' '}
              You cannot undo this action afterwards.
            </AlertDialogBody>
            <AlertDialogFooter>
              <Button
                variant="outline"
                ref={cancelDeleteButton}
                onClick={closeDeleteConfirmation}
              >
                Cancel
              </Button>
              <Button colorScheme="red" onClick={deleteBranch} ml={3}>
                Delete
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialogOverlay>
      </AlertDialog>
      {/*
       * Nexted branch editor (pops up in modal)
       */}
      {/* Nested If-Thens should have depth = depth + 1 */}
      <BranchContext.Provider value={{ depth: depth + 1 }}>
        <StepDisplayOverridesProvider value={initialStepDisplayOverride}>
          <NestedEditor
            onClose={closeEditor}
            isOpen={editorIsOpen}
            flow={flow}
            steps={steps}
          />
        </StepDisplayOverridesProvider>
      </BranchContext.Provider>
    </>
  )
}
