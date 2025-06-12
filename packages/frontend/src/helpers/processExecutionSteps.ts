import { IExecutionStep } from '@plumber/types'

import { TOOLBOX_ACTIONS, TOOLBOX_APP_KEY } from '@/helpers/toolbox'

export type GroupedSteps = Array<{
  iteration: number
  steps: IExecutionStep[]
  status: string
}>

export default function processExecutionSteps(
  executionSteps: IExecutionStep[],
) {
  const groupingStepIndex = executionSteps?.findIndex(
    (s) => s.appKey === TOOLBOX_APP_KEY && s.key === TOOLBOX_ACTIONS.ForEach,
  )

  if (groupingStepIndex && groupingStepIndex === -1) {
    return {
      groupingStep: {} as IExecutionStep,
      groupStats: { success: 0, failure: 0, waiting: 0 },
      groupedSteps: [] as GroupedSteps,
      hasGrouping: false,
      stepsBeforeGroup: executionSteps,
    }
  }

  const stepsBeforeGroup = executionSteps?.slice(0, groupingStepIndex)
  const groupingStep = executionSteps?.slice(groupingStepIndex)[0]
  const stepsAfterGroup = executionSteps?.slice(groupingStepIndex + 1)

  const iterationMap = new Map<
    number,
    {
      iteration: number
      steps: IExecutionStep[]
      status: string
    }
  >()

  stepsAfterGroup?.forEach((step) => {
    const { iteration } = step.metadata
    if (iteration) {
      let iterationGroup = iterationMap.get(iteration)

      if (!iterationGroup) {
        iterationGroup = { iteration, steps: [], status: 'failure' }
        iterationMap.set(iteration, iterationGroup)
      }

      iterationGroup.steps.push(step)
      iterationGroup.status = 'waiting'
      if (step.status === 'failure') {
        iterationGroup.status = 'failure'
      }
      const isGroupComplete = iterationGroup.steps.find(
        (s) => s.metadata.isLastStep,
      )

      if (isGroupComplete) {
        const isGroupSuccess = iterationGroup.steps.every(
          (s) => s.status === 'success',
        )
        if (isGroupSuccess) {
          iterationGroup.status = 'success'
        } else {
          iterationGroup.status = 'failure'
        }
      }
    }
  })

  const groupedSteps = Array.from(iterationMap.values()).sort(
    (a, b) => a.iteration - b.iteration,
  )

  const groupStats = (groupedSteps || []).reduce(
    (counts, iteration) => {
      counts[iteration.status as keyof typeof counts] =
        (counts[iteration.status as keyof typeof counts] || 0) + 1
      return counts
    },
    { success: 0, failure: 0, waiting: 0 },
  )

  return {
    groupingStep,
    groupStats,
    hasGrouping: groupingStepIndex && groupingStepIndex !== -1,
    groupedSteps,
    stepsBeforeGroup,
  }
}
