import { IStep } from '@plumber/types'

import { MouseEventHandler, useCallback, useRef } from 'react'
import { BiTrashAlt } from 'react-icons/bi'
import { useMutation } from '@apollo/client'
import { Flex, useDisclosure } from '@chakra-ui/react'
import { IconButton, useIsMobile } from '@opengovsg/design-system-react'

import MenuAlertDialog from '@/components/MenuAlertDialog'
import { DELETE_STEP } from '@/graphql/mutations/delete-step'
import { GET_FLOW } from '@/graphql/queries/get-flow'

interface StepDeleteButtonProps {
  isNested?: boolean
  onClose: () => void
  isDeletingStep?: boolean
  step: IStep
}

export default function StepDeleteButton(props: StepDeleteButtonProps) {
  const { isNested, onClose, step } = props
  const cancelRef = useRef<HTMLButtonElement>(null)
  const {
    isOpen: isDialogOpen,
    onOpen: onDialogOpen,
    onClose: onDialogClose,
  } = useDisclosure()
  const isMobile = useIsMobile()

  const [deleteStep, { loading: isDeletingStep }] = useMutation(DELETE_STEP, {
    refetchQueries: [GET_FLOW],
  })

  const onDelete = useCallback<MouseEventHandler>(
    async (e) => {
      e.stopPropagation()
      await deleteStep({ variables: { input: { ids: [step.id] } } })
      // NOTE: this ensures that the drawer is closed and step headers
      // return to the original width when the drawer is closed
      onClose()
    },
    [deleteStep, step.id, onClose],
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
          icon={<BiTrashAlt />}
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
