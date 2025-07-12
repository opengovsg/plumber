import { IStep } from '@plumber/types'

import { MouseEventHandler, useCallback, useRef } from 'react'
import { useMutation } from '@apollo/client'
import { useDisclosure } from '@chakra-ui/react'

import { DELETE_STEP } from '@/graphql/mutations/delete-step'
import { GET_FLOW } from '@/graphql/queries/get-flow'
import { TOOLBOX_ACTIONS } from '@/helpers/toolbox'

const useDeleteConfirmation = (type: string, groupedSteps: IStep[][]) => {
  const { isOpen, onOpen, onClose } = useDisclosure()
  const cancelRef = useRef<HTMLButtonElement>(null)

  const [deleteStep, { loading: isDeletingBranch }] = useMutation(DELETE_STEP, {
    refetchQueries: [GET_FLOW],
  })

  const openDeleteConfirmation = useCallback<MouseEventHandler>(
    (e) => {
      e.stopPropagation()
      onOpen()
    },
    [onOpen],
  )

  const onDelete = useCallback(async () => {
    if (type === TOOLBOX_ACTIONS.ForEach) {
      /**
       *  deleting the entire for-each deletes the entire for-each loop
       * and all the steps inside it.
       */
      const flatSteps = groupedSteps.flat()
      const idsToDelete = flatSteps.map((step) => step.id)
      await deleteStep({
        variables: { input: { ids: idsToDelete } },
      })
    } else {
      // TODO: refactor branch deletion
    }
    onClose()
  }, [deleteStep, groupedSteps, onClose, type])

  return {
    cancelRef,
    isDeletingBranch,
    isOpen,
    onDelete,
    onOpen,
    onClose,
    openDeleteConfirmation,
  }
}

export default useDeleteConfirmation
