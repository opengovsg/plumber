import { IStep } from '@plumber/types'

import { MouseEventHandler, useCallback, useContext, useRef } from 'react'
import { BiTrash } from 'react-icons/bi'
import { useMutation } from '@apollo/client'
import { Flex, useDisclosure } from '@chakra-ui/react'
import { IconButton } from '@opengovsg/design-system-react'

import UnsavedChangesAlert from '@/components/Editor/components/UnsavedChangesAlert'
import MenuAlertDialog from '@/components/MenuAlertDialog'
import { EditorContext } from '@/contexts/Editor'
import client from '@/graphql/client'
import { CREATE_STEP } from '@/graphql/mutations/create-step'
import { DELETE_STEP } from '@/graphql/mutations/delete-step'
import { GET_FLOW } from '@/graphql/queries/get-flow'
import { GET_TEST_EXECUTION_STEPS } from '@/graphql/queries/get-test-execution-steps'
import { useUnsavedChanges } from '@/hooks/useUnsavedChanges'

import { findAdjacentSteps, shouldCreateEmptyStep } from '../utils'

interface DeleteStepButtonProps {
  isNested?: boolean
  isDeletingStep?: boolean
  step: IStep
  stepName: string
  displayPosition?: number
  /** Skip FlowStep’s hover-reveal CSS — parent already controls visibility. */
  alwaysVisible?: boolean
}

export default function DeleteStepButton(props: DeleteStepButtonProps) {
  const {
    isNested,
    step,
    stepName,
    displayPosition,
    alwaysVisible = false,
  } = props
  const cancelRef = useRef<HTMLButtonElement>(null)
  const customBody = stepName
    ? `Are you sure you want to delete step **${
        displayPosition ? `${displayPosition}. ` : ''
      }${stepName}**? You can't undo this action afterwards.`
    : undefined
  const {
    isOpen: isDialogOpen,
    onOpen: onDialogOpen,
    onClose: onDialogClose,
  } = useDisclosure()

  const {
    flow,
    isMobile,
    onDrawerClose,
    setCurrentStepId,
    setShouldWarnOnLeave,
  } = useContext(EditorContext)

  const {
    cancelRef: cancelUnsavedRef,
    isWarningOpen,
    onWarningClose,
    handleProceed,
    handleLeave,
  } = useUnsavedChanges({
    onProceed: onDialogOpen,
  })

  /**
   * NOTE: refetch test execution steps when deleting a step so that we can
   * check which steps are using variables from steps that have been deleted
   */
  const [deleteStep, { loading: isDeletingStep }] = useMutation(DELETE_STEP, {
    fetchPolicy: 'no-cache',
  })
  const [createStep, { loading: isCreatingStep }] = useMutation(CREATE_STEP, {
    fetchPolicy: 'no-cache',
  })

  const onDelete = useCallback<MouseEventHandler>(
    async (e) => {
      e.stopPropagation()

      const deletedStep = await deleteStep({
        variables: {
          input: { ids: [step.id], flow: { updatedAt: flow.updatedAt } },
        },
      })
      const updatedFlow = deletedStep.data?.deleteStep
      const { previousStep, nextStep } = findAdjacentSteps(
        flow?.steps,
        step.position,
      )

      // NOTE: delete before creating to avoid race condition and ensure position is correct
      if (shouldCreateEmptyStep(previousStep, nextStep)) {
        await createStep({
          variables: {
            input: {
              previousStep: { id: previousStep?.id },
              flow: {
                id: flow.id,
                updatedAt: updatedFlow?.updatedAt,
              },
            },
          },
        })
      }

      await client.refetchQueries({
        include: [GET_FLOW, GET_TEST_EXECUTION_STEPS],
      })

      // NOTE: this ensures that the drawer is closed and step headers
      // return to the original width when the drawer is closed
      setCurrentStepId(null)
      setShouldWarnOnLeave(false)
      onDrawerClose()
    },
    [
      flow,
      step,
      deleteStep,
      setCurrentStepId,
      setShouldWarnOnLeave,
      onDrawerClose,
      createStep,
    ],
  )

  if (!step.id) {
    return null
  }

  return (
    <>
      <Flex ml="auto">
        <IconButton
          boxSize={isNested ? 6 : 8}
          onClick={(event) => {
            event.stopPropagation()
            handleProceed()
          }}
          variant="clear"
          aria-label="Delete Step"
          colorScheme="secondary"
          icon={<BiTrash />}
          minHeight={isNested ? 6 : 8}
          minWidth={isNested ? 6 : 8}
          className={
            isMobile || alwaysVisible ? undefined : 'hover-remove-button'
          }
          visibility={isMobile || alwaysVisible ? 'visible' : 'hidden'}
        />
      </Flex>

      <MenuAlertDialog
        isDialogOpen={isDialogOpen}
        cancelRef={cancelRef}
        onDialogClose={onDialogClose}
        dialogHeader="Step"
        dialogType="delete"
        onClick={onDelete}
        isLoading={isDeletingStep || isCreatingStep}
        customBody={customBody}
      />

      <UnsavedChangesAlert
        cancelRef={cancelUnsavedRef}
        isOpen={isWarningOpen}
        onClose={onWarningClose}
        onLeave={handleLeave}
      />
    </>
  )
}
