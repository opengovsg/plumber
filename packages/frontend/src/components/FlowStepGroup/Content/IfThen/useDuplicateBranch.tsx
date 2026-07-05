import { IStep } from '@plumber/types'

import { useCallback, useContext, useMemo, useState } from 'react'
import { useMutation } from '@apollo/client'
import { useDisclosure } from '@chakra-ui/react'

import { EditorContext } from '@/contexts/Editor'
import { StepEnumType } from '@/graphql/__generated__/graphql'
import { DUPLICATE_BRANCH } from '@/graphql/mutations/duplicate-branch'
import { UPDATE_STEP_POSITIONS } from '@/graphql/mutations/update-step-positions'
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
  const [updateStepPositions] = useMutation(UPDATE_STEP_POSITIONS, {
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

      // Splice the duplicate into the chain: the duplicated branch now points
      // its step to jump to at the new branch, which already inherited the
      // duplicated branch's old target via the copied parameters. Skip legacy
      // branches (no stored step to jump to) — the execution scan handles those.
      const duplicatedIfThen = branchSteps[0]
      if (Object.hasOwn(duplicatedIfThen.parameters ?? {}, 'stepIdToJumpTo')) {
        await updateStepPositions({
          variables: {
            input: {
              stepPositions: [
                {
                  id: duplicatedIfThen.id,
                  position: duplicatedIfThen.position,
                  type: duplicatedIfThen.type as StepEnumType,
                  stepIdToJumpTo: newSteps[0].id,
                },
              ],
              flow: {
                updatedAt: duplicatedBranch.data.duplicateBranch.flow.updatedAt,
              },
            },
          },
        })
      }

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
