import { IStep } from '@plumber/types'

import { useCallback, useContext, useMemo, useState } from 'react'
import { useMutation } from '@apollo/client'
import { useDisclosure } from '@chakra-ui/react'

import { EditorContext } from '@/contexts/Editor'
import client from '@/graphql/client'
import { CREATE_STEP } from '@/graphql/mutations/create-step'
import { GET_FLOW } from '@/graphql/queries/get-flow'
import { TOOLBOX_ACTIONS } from '@/helpers/toolbox'

export default function useDuplicateBranch(branchSteps: IStep[]) {
  const {
    isOpen: duplicateConfirmationIsOpen,
    onOpen: openDuplicateConfirmationImpl,
    onClose: closeDuplicateConfirmation,
  } = useDisclosure()

  const [isDuplicatingBranch, setIsDuplicatingBranch] = useState(false)
  const {
    flow,
    isDrawerOpen,
    onDrawerOpen,
    setCurrentStepId,
    setCurrentStepIndex,
  } = useContext(EditorContext)

  const [createStep] = useMutation(CREATE_STEP, { fetchPolicy: 'no-cache' })

  const canDuplicateBranch = useMemo(() => {
    return (
      branchSteps.length >= 2 &&
      branchSteps.every((step) => step.appKey && step.key)
    )
  }, [branchSteps])

  const duplicateBranch = async () => {
    closeDuplicateConfirmation()

    if (branchSteps.length < 2) {
      return
    }

    setIsDuplicatingBranch(true)

    let newConditionId = null
    let newConditionIndex = null
    let previousStepId = branchSteps[branchSteps.length - 1]?.id
    if (!previousStepId) {
      return
    }
    // Create steps sequentially to avoid serialization conflicts
    for (const step of branchSteps) {
      const { appKey, key, connection, parameters } = step
      const { branchName, ...restParameters } = parameters

      // use a new branch name
      const newBranchName = `[COPY] ${branchName}`

      const mutationInput = {
        previousStep: { id: previousStepId },
        flow: { id: flow.id },
        appKey,
        key,
        ...(connection && { connection: { id: connection.id } }),
        parameters: {
          ...restParameters,
          ...(branchName && { branchName: newBranchName }),
        },
      }

      const createdStep = await createStep({
        fetchPolicy: 'no-cache',
        variables: { input: mutationInput },
      })

      if (key === TOOLBOX_ACTIONS.IfThen) {
        newConditionId = createdStep.data.createStep.id
        newConditionIndex = createdStep.data.createStep.position - 1
      }

      // use the new step id as the previous step id for the next step
      previousStepId = createdStep.data.createStep.id
    }

    // Refetch flow data only once after all steps are created
    await client.refetchQueries({ include: [GET_FLOW] })

    setCurrentStepId(newConditionId)
    setCurrentStepIndex(newConditionIndex)
    setIsDuplicatingBranch(false)
    if (!isDrawerOpen) {
      onDrawerOpen()
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
    duplicateBranch,
    openDuplicateConfirmation,
  }
}
