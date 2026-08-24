import { useMutation } from '@apollo/client'
import { useDisclosure } from '@chakra-ui/react'
import { IStep } from '@plumber/types'
import { MouseEventHandler, useCallback, useContext, useRef } from 'react'

import { EditorContext } from '@/contexts/Editor'
import { DELETE_STEP } from '@/graphql/mutations/delete-step'
import { GET_FLOW } from '@/graphql/queries/get-flow'
import { TOOLBOX_ACTIONS } from '@/helpers/toolbox'

const useDeleteStepConfirmation = (
  type: string,
  groupedSteps: IStep[][],
  branchSteps?: IStep[],
) => {
  const { flow } = useContext(EditorContext)
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
    const flowInput = { updatedAt: flow.updatedAt }
    if (type === TOOLBOX_ACTIONS.ForEach) {
      /**
       *  deleting the entire for-each deletes the entire for-each loop
       * and all the steps inside it.
       */
      const flatSteps = groupedSteps.flat()
      const idsToDelete = flatSteps.map((step) => step.id)
      await deleteStep({
        variables: { input: { ids: idsToDelete, flow: flowInput } },
      })
    } else if (type === TOOLBOX_ACTIONS.IfThen && branchSteps) {
      const idsToDelete = branchSteps.map((step) => step.id)
      await deleteStep({
        variables: { input: { ids: idsToDelete, flow: flowInput } },
      })
    }
    onClose()
  }, [branchSteps, deleteStep, flow.updatedAt, groupedSteps, onClose, type])

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

export default useDeleteStepConfirmation
