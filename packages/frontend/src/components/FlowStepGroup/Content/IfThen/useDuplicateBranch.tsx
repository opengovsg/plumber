import { IStep } from '@plumber/types'

import { useCallback, useContext, useMemo, useState } from 'react'
import { useMutation } from '@apollo/client'
import { useDisclosure } from '@chakra-ui/react'

import { EditorContext } from '@/contexts/Editor'
import { DUPLICATE_BRANCH } from '@/graphql/mutations/duplicate-branch'
import { GET_FLOW } from '@/graphql/queries/get-flow'

export default function useDuplicateBranch(branchSteps: IStep[]) {
  const {
    isOpen: duplicateConfirmationIsOpen,
    onOpen: openDuplicateConfirmationImpl,
    onClose: closeDuplicateConfirmation,
  } = useDisclosure()

  const [isDuplicatingBranch, setIsDuplicatingBranch] = useState(false)
  const { flow, isDrawerOpen, onDrawerOpen, setCurrentStepId } =
    useContext(EditorContext)

  const [duplicateBranch] = useMutation(DUPLICATE_BRANCH, {
    fetchPolicy: 'no-cache',
    refetchQueries: [GET_FLOW],
  })

  const canDuplicateBranch = useMemo(() => {
    return (
      branchSteps.length >= 2 &&
      branchSteps.every((step) => step.appKey && step.key)
    )
  }, [branchSteps])

  const onDuplicateBranch = async () => {
    closeDuplicateConfirmation()

    if (branchSteps.length < 2) {
      return
    }

    setIsDuplicatingBranch(true)

    try {
      const previousStepId = branchSteps[branchSteps.length - 1]?.id
      if (!previousStepId) {
        return
      }

      const mutationInput = {
        flow: { id: flow.id, updatedAt: flow.updatedAt },
        previousStep: { id: previousStepId },
        steps: branchSteps.map((step) => {
          const { appKey, key, connection, parameters } = step
          const { branchName, ...restParameters } = parameters
          const newBranchName = `[COPY] ${branchName}`
          return {
            key,
            appKey,
            ...(connection && { connection: { id: connection.id } }),
            parameters: {
              ...restParameters,
              ...(branchName && { branchName: newBranchName }),
            },
            config: {
              approval: step.config?.approval,
            },
          }
        }),
      }

      const duplicatedBranch = await duplicateBranch({
        variables: { input: mutationInput },
      })

      const newSteps = duplicatedBranch.data.duplicateBranch.steps

      setCurrentStepId(newSteps[0].id)
      if (!isDrawerOpen) {
        onDrawerOpen()
      }
    } catch (err) {
      console.error('Error duplicating branch', err)
    } finally {
      setIsDuplicatingBranch(false)
    }
  }

  const openDuplicateConfirmation = useCallback(() => {
    openDuplicateConfirmationImpl()
  }, [openDuplicateConfirmationImpl])

  return {
    canDuplicateBranch,
    duplicateConfirmationIsOpen,
    isDuplicatingBranch,
    closeDuplicateConfirmation,
    duplicateBranch: onDuplicateBranch,
    openDuplicateConfirmation,
  }
}
