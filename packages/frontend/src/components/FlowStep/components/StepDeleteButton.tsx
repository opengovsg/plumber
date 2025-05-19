import { IStep } from '@plumber/types'

import { MouseEventHandler, useCallback, useContext, useRef } from 'react'
import { BiTrash } from 'react-icons/bi'
import { useMutation } from '@apollo/client'
import { Flex, useDisclosure } from '@chakra-ui/react'
import { IconButton } from '@opengovsg/design-system-react'

import MenuAlertDialog from '@/components/MenuAlertDialog'
import { EditorContext } from '@/contexts/Editor'
import { DELETE_STEP } from '@/graphql/mutations/delete-step'
import { GET_FLOW } from '@/graphql/queries/get-flow'
import { GET_TEST_EXECUTION_STEPS } from '@/graphql/queries/get-test-execution-steps'

interface StepDeleteButtonProps {
  isNested?: boolean
  isDeletingStep?: boolean
  step: IStep
}

export default function StepDeleteButton(props: StepDeleteButtonProps) {
  const { isNested, step } = props
  const cancelRef = useRef<HTMLButtonElement>(null)
  const {
    isOpen: isDialogOpen,
    onOpen: onDialogOpen,
    onClose: onDialogClose,
  } = useDisclosure()

  const {
    isMobile,
    onDrawerClose,
    setCurrentStepId,
    setCurrentStepIndex,
    setShouldWarnOnLeave,
  } = useContext(EditorContext)

  /**
   * NOTE: refetch test execution steps when deleting a step so that we can
   * check which steps are using variables from steps that have been deleted
   */
  const [deleteStep, { loading: isDeletingStep }] = useMutation(DELETE_STEP, {
    refetchQueries: [GET_FLOW, GET_TEST_EXECUTION_STEPS],
  })

  const onDelete = useCallback<MouseEventHandler>(
    async (e) => {
      e.stopPropagation()
      await deleteStep({ variables: { input: { ids: [step.id] } } })
      // NOTE: this ensures that the drawer is closed and step headers
      // return to the original width when the drawer is closed
      setCurrentStepId(null)
      setCurrentStepIndex(null)
      setShouldWarnOnLeave(false)
      onDrawerClose()
    },
    [
      step.id,
      deleteStep,
      onDrawerClose,
      setCurrentStepId,
      setCurrentStepIndex,
      setShouldWarnOnLeave,
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
            onDialogOpen()
            event.stopPropagation()
          }}
          variant="clear"
          aria-label="Delete Step"
          colorScheme="secondary"
          icon={<BiTrash />}
          minHeight={isNested ? 6 : 8}
          minWidth={isNested ? 6 : 8}
          className={isMobile ? undefined : 'hover-remove-button'}
          visibility={isMobile ? 'visible' : 'hidden'}
        />
      </Flex>

      <MenuAlertDialog
        isDialogOpen={isDialogOpen}
        cancelRef={cancelRef}
        onDialogClose={onDialogClose}
        dialogHeader="Step"
        dialogType="delete"
        onClick={onDelete}
        isLoading={isDeletingStep}
      />
    </>
  )
}
