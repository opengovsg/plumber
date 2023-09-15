import { type IFlow, type IStep } from '@plumber/types'

import { type MouseEventHandler, useCallback, useMemo, useRef } from 'react'
import { BiTrashAlt } from 'react-icons/bi'
import { useMutation } from '@apollo/client'
import {
  AlertDialog,
  AlertDialogBody,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogOverlay,
  Flex,
  Text,
  useDisclosure,
} from '@chakra-ui/react'
import { Button, IconButton } from '@opengovsg/design-system-react'
import NestedEditor from 'components/FlowStepGroup/NestedEditor'
import {
  type StepDisplayOverridesContextData,
  StepDisplayOverridesProvider,
} from 'contexts/StepDisplayOverrides'
import { DELETE_STEP } from 'graphql/mutations/delete-step'

interface BranchProps {
  flow: IFlow
  steps: IStep[]
  defaultName: string
}

export default function Branch(props: BranchProps): JSX.Element {
  const { flow, steps, defaultName } = props
  const {
    isOpen: editorIsOpen,
    onOpen: openEditor,
    onClose: closeEditor,
  } = useDisclosure()

  const initialStep = steps[0]
  const initialStepDisplayOverride = useMemo<StepDisplayOverridesContextData>(
    () => ({
      [initialStep.id]: {
        hintAboveCaption: 'If... Then',
        caption: (initialStep.parameters.branchName as string) ?? defaultName,
        disableActionChanges: true,
        disableDelete: true,
      },
    }),
    [initialStep.id, initialStep.parameters.branchName, defaultName],
  )

  const {
    isOpen: deleteConfirmationIsOpen,
    onOpen: openDeleteConfirmationImpl,
    onClose: closeDeleteConfirmation,
  } = useDisclosure()
  const cancelDeleteButton = useRef<HTMLButtonElement>(null)
  const [deleteStep, { loading: isDeletingBranch }] = useMutation(DELETE_STEP, {
    refetchQueries: ['GetFlow'],
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

  return (
    <>
      {/*
       * Branch row
       */}
      <Flex
        onClick={openEditor}
        h={16}
        w="full"
        alignItems="center"
        px={4}
        _hover={{ bg: 'interaction.muted.main.hover', cursor: 'pointer' }}
        _active={{ bg: 'interaction.muted.main.active' }}
      >
        <Text textStyle="subhead-1">
          {steps[0].parameters.branchName
            ? String(steps[0].parameters.branchName)
            : defaultName}
        </Text>
        <IconButton
          onClick={openDeleteConfirmation}
          variant="clear"
          aria-label="Delete Branch"
          icon={<BiTrashAlt />}
          isLoading={isDeletingBranch}
          ml="auto"
        />
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
      <StepDisplayOverridesProvider value={initialStepDisplayOverride}>
        <NestedEditor
          onClose={closeEditor}
          isOpen={editorIsOpen}
          flow={flow}
          steps={steps}
        />
      </StepDisplayOverridesProvider>
    </>
  )
}
