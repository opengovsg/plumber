import { useMutation } from '@apollo/client'
import { useToast } from '@opengovsg/design-system-react'

import { StepEnumType } from '@/graphql/__generated__/graphql'
import { UPDATE_STEP_POSITIONS } from '@/graphql/mutations/update-step-positions'
import { GET_FLOW } from '@/graphql/queries/get-flow'

interface StepPositionInput {
  id: string
  position: number
  type: StepEnumType
}

const useReorderSteps = (flowId: string) => {
  const toast = useToast()
  const [updateStepPositions] = useMutation(UPDATE_STEP_POSITIONS)

  const handleReorderUpdate = async (stepPositions: StepPositionInput[]) => {
    try {
      await updateStepPositions({
        variables: { input: { stepPositions } },
        optimisticResponse: {
          updateStepPositions: stepPositions.map((sp) => ({
            id: sp.id,
            position: sp.position,
            __typename: 'Step' as const,
          })),
        },
        update: (cache) => {
          // Update the cache with the new step positions optimistically
          const existingData = cache.readQuery({
            query: GET_FLOW,
            variables: { id: flowId },
          }) as { getFlow: any } | null

          if (existingData?.getFlow) {
            // Create a map of step positions for quick lookup
            const positionMap = new Map(
              stepPositions.map((sp) => [sp.id, sp.position]),
            )

            // Update steps with new positions
            const updatedSteps = existingData.getFlow.steps.map((step: any) => {
              const newPosition = positionMap.get(step.id)
              return newPosition !== undefined
                ? { ...step, position: newPosition }
                : step
            })

            // Sort steps by position to maintain proper order
            updatedSteps.sort((a: any, b: any) => a.position - b.position)

            // Write the updated data back to the cache
            cache.writeQuery({
              query: GET_FLOW,
              variables: { id: flowId },
              data: {
                getFlow: {
                  ...existingData.getFlow,
                  steps: updatedSteps,
                },
              },
            })
          }
        },
        onError: (error) => {
          toast({
            title: 'Failed to reorder steps',
            description: 'Your changes have been reverted. Please try again.',
            status: 'error',
            duration: 5000,
            isClosable: true,
            position: 'top',
          })
          console.error(
            'Error updating step positions: ',
            error,
            JSON.stringify(stepPositions),
          )
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

  return { handleReorderUpdate }
}

export default useReorderSteps
