import {
  IExecutionStep,
  IJSONObject,
  IJSONValue,
  IStep,
  NextStepMetadata,
} from '@plumber/types'

import get from 'lodash.get'

import {
  FOR_EACH_ITERATION_KEY,
  TOOLBOX_ACTIONS,
  TOOLBOX_APP_KEY,
} from '@/apps/toolbox/common/constants'
import Flow from '@/models/flow'

export type ForEachContext = {
  testRun: boolean
  executionStepMetadata: NextStepMetadata
  forEachStepIndex: number
  isForEachStep: boolean

  stepPositions: Record<string, number>
}

export function getForEachContext(
  flow: Flow,
  step: IStep,
): {
  forEachStepIndex: number
  stepPositions: Record<string, number>
  isForEachStep: boolean
} {
  const isForEachStep =
    step.appKey === TOOLBOX_APP_KEY && step.key === TOOLBOX_ACTIONS.FOR_EACH
  const forEachSteps = flow.steps.filter(
    (step) =>
      step.appKey === TOOLBOX_APP_KEY && step.key === TOOLBOX_ACTIONS.FOR_EACH,
  )
  // NOTE: do not allow multiple for-each steps in a flow
  if (forEachSteps.length === 0 || forEachSteps.length > 1) {
    return {
      forEachStepIndex: -1,
      stepPositions: {},
      isForEachStep,
    }
  }

  const stepPositions = flow.steps.reduce((acc, step) => {
    acc[step.id] = step.position
    return acc
  }, {} as Record<string, number>)

  return {
    forEachStepIndex: forEachSteps[0].position,
    stepPositions,
    isForEachStep,
  }
}

/**
 * NOTE: special handling for for-each
 * data can come from multiple sources:
 * 1. from steps before the for-each
 * 2. from the for-each step itself (i.e., checkbox or table data)
 * 3. from a step within for-each
 */
export function computeForEachParameters({
  data,
  keyPath,
  executionSteps,
  executionStep,
  stepId,
  forEachContext,
}: {
  data: IJSONObject
  keyPath: string
  executionSteps: IExecutionStep[]
  executionStep: IExecutionStep
  stepId: string
  forEachContext: ForEachContext
}): IJSONValue {
  const {
    testRun,
    executionStepMetadata: metadata,
    forEachStepIndex,
    stepPositions,
  } = forEachContext || {}

  let dataValue: IJSONValue = keyPath
  let forEachKeyPath = get(data, keyPath)
  const currentStepIndex = stepPositions?.[executionStep?.stepId] || -1

  if (testRun || metadata?.iteration) {
    forEachKeyPath = String(forEachKeyPath).replace(
      FOR_EACH_ITERATION_KEY,
      `${testRun ? 0 : metadata.iteration - 1}`,
    )
  }

  if (
    executionStep.appKey === TOOLBOX_APP_KEY &&
    executionStep.key === TOOLBOX_ACTIONS.FOR_EACH
  ) {
    dataValue = get(data, forEachKeyPath as string) || ''
  } else if (currentStepIndex > forEachStepIndex) {
    // find the specific execution step for the same iteration
    const iterationExecutionStep = executionSteps.find(
      (es) =>
        es.stepId === stepId && es.metadata.iteration === metadata?.iteration,
    )
    dataValue = get(iterationExecutionStep?.dataOut, keyPath) || ''
  }

  return dataValue
}
