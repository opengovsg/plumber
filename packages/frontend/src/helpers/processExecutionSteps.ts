import { IExecutionStep } from '@plumber/types'

import { TOOLBOX_ACTIONS, TOOLBOX_APP_KEY } from '@/helpers/toolbox'

export type GroupedSteps = Array<{
  iteration: number
  steps: IExecutionStep[]
  status: string
}>

export type GroupStats = {
  success: number
  failure: number
  waiting: number
  'partial-success': number
}

const DEFAULT_EMPTY_RESULT = {
  groupingStep: {} as IExecutionStep,
  groupStats: { success: 0, failure: 0, waiting: 0, 'partial-success': 0 },
  hasGrouping: false,
  iterationMap: new Map<number, string>(),
  stepsBeforeGroup: [],
}

export default function processExecutionSteps(
  executionSteps: IExecutionStep[],
) {
  if (!executionSteps?.length) {
    return DEFAULT_EMPTY_RESULT
  }

  const groupingStepIndex = executionSteps?.findIndex(
    (s) => s.appKey === TOOLBOX_APP_KEY && s.key === TOOLBOX_ACTIONS.ForEach,
  )
  const forEachStep = executionSteps?.find(
    (s) => s.appKey === TOOLBOX_APP_KEY && s.key === TOOLBOX_ACTIONS.ForEach,
  )
  const iterationStatus = forEachStep?.metadata?.iterationStatus
  if (groupingStepIndex === -1) {
    return {
      ...DEFAULT_EMPTY_RESULT,
      stepsBeforeGroup: executionSteps,
    }
  }

  const stepsBeforeGroup = executionSteps?.slice(0, groupingStepIndex)
  const groupingStep = executionSteps?.slice(groupingStepIndex)[0]

  const iterationMap = new Map<number, string>()

  Object.entries(iterationStatus ?? {}).forEach(([iterationKey, status]) => {
    const iteration = parseInt(iterationKey.split('_')[1], 10)
    iterationMap.set(iteration, status ? status : 'waiting')
  })

  const groupStats: GroupStats = {
    success: 0,
    failure: 0,
    waiting: 0,
    'partial-success': 0,
  }

  for (const [, status] of iterationMap) {
    groupStats[status as keyof typeof groupStats] =
      (groupStats[status as keyof typeof groupStats] || 0) + 1
  }

  return {
    groupingStep,
    groupStats,
    hasGrouping: groupingStepIndex !== -1,
    iterationMap,
    stepsBeforeGroup,
  }
}
