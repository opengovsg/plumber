import { IStep } from '@plumber/types'

import { useContext } from 'react'
import { useMutation } from '@apollo/client'
import { useToast } from '@opengovsg/design-system-react'

import { EditorContext } from '@/contexts/Editor'
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
  const { flow } = useContext(EditorContext)
  const [updateStepPositions] = useMutation(UPDATE_STEP_POSITIONS, {
    refetchQueries: [GET_FLOW],
  })

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
            const positionMap = new Map(
              stepPositions.map((sp) => [sp.id, sp.position]),
            )

            // Update steps with new positions
            const updatedSteps = flow.steps.map((step: IStep) => {
              const newPosition = positionMap.get(step.id)
              return newPosition !== undefined
                ? { ...step, position: newPosition }
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
