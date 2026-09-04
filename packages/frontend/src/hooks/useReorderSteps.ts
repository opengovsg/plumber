import { useMutation } from '@apollo/client'
import { IStep, IStepApprovalBranch } from '@plumber/types'
import { useCallback, useContext } from 'react'

import { EditorContext } from '@/contexts/Editor'
import {
  StepEnumType,
  StepPositionInput,
} from '@/graphql/__generated__/graphql'
import { UPDATE_STEP_POSITIONS } from '@/graphql/mutations/update-step-positions'
import { GET_FLOW } from '@/graphql/queries/get-flow'

const useReorderSteps = (flowId: string) => {
  const { flow } = useContext(EditorContext)
  const [updateStepPositions] = useMutation(UPDATE_STEP_POSITIONS, {
    refetchQueries: [GET_FLOW],
  })

  // TODO: write unit test for this function
  const calculateReorderedSteps = useCallback(
    ({
      reorderedSteps,
      allSteps,
      mrfSteps,
      mrfApprovalSteps,
      approvalBranches,
    }: {
      reorderedSteps: IStep[]
      allSteps: IStep[]
      mrfSteps: IStep[]
      mrfApprovalSteps: IStep[]
      approvalBranches: { [stepId: string]: IStepApprovalBranch }
    }): StepPositionInput[] => {
      // Seed from the earliest position in the reordered set so a subset that
      // doesn't begin right after the trigger renumbers from its own start.
      // The top-level action list starts at position 2 (position 1 is the
      // trigger, which is not part of the sortable list), so this is
      // behaviour-identical for the old layout.
      let nextPosition = reorderedSteps.length
        ? Math.min(...reorderedSteps.map((step) => step.position))
        : 2
      let currentApprovalBranch: {
        stepId: string
        branch: 'approve' | 'reject'
      } | null = null
      const allReorderedSteps: StepPositionInput[] = []
      reorderedSteps.forEach((reorderingStep) => {
        const isMrfStep = mrfSteps.some(
          (mrfStep) => mrfStep.id === reorderingStep.id,
        )

        if (isMrfStep) {
          // if the previous approval config is in the approve branch
          // we need to add the steps in the reject branch that was hidden
          if (currentApprovalBranch?.branch === 'approve') {
            const stepsInRejectBranch = allSteps.filter(
              (step) =>
                step.config?.approval?.branch === 'reject' &&
                step.config?.approval?.stepId === currentApprovalBranch?.stepId,
            ) as IStep[]
            stepsInRejectBranch.forEach((step) => {
              allReorderedSteps.push({
                id: step.id,
                position: nextPosition++,
                type: step.type as StepEnumType,
              })
            })
          }
          currentApprovalBranch = null
        }

        // add the current step to the list
        allReorderedSteps.push({
          id: reorderingStep.id,
          position: nextPosition++,
          type: reorderingStep.type as StepEnumType,
          config:
            currentApprovalBranch?.branch === 'reject'
              ? {
                  approval: currentApprovalBranch,
                }
              : { approval: null }, // this sets it to approval branch
        })

        const isMrfApprovalStep = mrfApprovalSteps.some(
          (mrfApprovalStep) => mrfApprovalStep.id === reorderingStep.id,
        )
        if (isMrfApprovalStep) {
          currentApprovalBranch = {
            branch: approvalBranches[reorderingStep.id],
            stepId: reorderingStep.id,
          }
          // if the current approval config is in the reject branch
          // we need to add the steps in the approve branch that was hidden
          if (currentApprovalBranch?.branch === 'reject') {
            const reorderingStepIndex = allSteps.findIndex(
              (step) => step.id === reorderingStep.id,
            )
            const stepsInApproveBranch = []
            // Search for non-mrf steps directly after the approval step
            for (let i = reorderingStepIndex + 1; i < allSteps.length; i++) {
              const step = allSteps[i]
              if (
                !step.config?.approval &&
                !mrfSteps.some((mrfStep) => mrfStep.id === step.id)
              ) {
                stepsInApproveBranch.push(step)
              } else {
                break
              }
            }
            stepsInApproveBranch.forEach((step) => {
              allReorderedSteps.push({
                id: step.id,
                position: nextPosition++,
                type: step.type as StepEnumType,
              })
            })
          }
        }
      })

      // all later steps not in the sortable list need not be updated since
      // reordering of visible steps will not affect them

      return allReorderedSteps
    },
    [],
  )

  const handleReorderUpdate = async (stepPositions: StepPositionInput[]) => {
    try {
      await updateStepPositions({
        variables: {
          input: { stepPositions, flow: { updatedAt: flow.updatedAt } },
        },
        optimisticResponse: {
          updateStepPositions: {
            updatedAt: flow.updatedAt,
            steps: stepPositions.map((sp) => ({
              id: sp.id,
              position: sp.position,
              config: sp.config ? { approval: sp.config.approval } : undefined,
              __typename: 'Step' as const,
            })),
          },
        },
        update: (cache: any) => {
          // Update the cache with the new step positions optimistically
          const { getFlow: flow } = cache.readQuery({
            query: GET_FLOW,
            variables: { id: flowId },
          })

          if (flow) {
            // Create a map of step positions for quick lookup
            const updatedStepMap = new Map(
              stepPositions.map((sp) => [
                sp.id,
                { position: sp.position, config: sp.config },
              ]),
            )

            // Update steps with new positions
            const updatedSteps = flow.steps.map((step: IStep) => {
              const updatedStep = updatedStepMap.get(step.id)
              return updatedStep !== undefined
                ? {
                    ...step,
                    position: updatedStep.position,
                    config: { ...step.config, ...updatedStep.config },
                  }
                : step
            })

            // Sort steps by position to maintain proper order
            updatedSteps.sort((a: IStep, b: IStep) => a.position - b.position)

            // Write the updated data back to the cache
            cache.writeQuery({
              query: GET_FLOW,
              variables: { id: flowId },
              data: {
                getFlow: {
                  ...flow,
                  steps: updatedSteps,
                },
              },
            })
          }
        },
      })
    } catch (error) {
      // Fallback error handling (in case onError doesn't trigger)
      console.error(
        'Error updating step positions: ',
        error,
        JSON.stringify(stepPositions),
      )
    }
  }

  return { handleReorderUpdate, calculateReorderedSteps }
}

export default useReorderSteps
