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
  executionStepMetadata: NextStepMetadata
  forEachStepPosition: number
  isForEachStep: boolean
  stepPositions: Record<string, number>
}

/**
 * gets the context for the step within the pipe
 * returns:
 * - forEachStepPosition: position of the for-each step in the pipe
 * - stepPositions: map of step ids and their corresponding positions
 * - isForEachStep: whether the step is a for-each step
 * - isLastStep: whether the step is the last step in the pipe
 * - isInsideForEach: whether the step is within the for-each loop
 */
export function getStepContext(
  flow: Flow,
  step: IStep,
): {
  forEachStepPosition: number
  stepPositions: Record<string, number>
  isForEachStep: boolean
  isLastStep: boolean
  isInsideForEach: boolean
} {
  const isForEachStep =
    step.appKey === TOOLBOX_APP_KEY && step.key === TOOLBOX_ACTIONS.FOR_EACH

  const stepApprovalConfig = step.config.approval
  const forEachSteps = flow.steps.filter(
    (currStep) =>
      currStep.appKey === TOOLBOX_APP_KEY &&
      currStep.key === TOOLBOX_ACTIONS.FOR_EACH &&
      currStep.config.approval?.branch === stepApprovalConfig?.branch &&
      currStep.config.approval?.stepId === stepApprovalConfig?.stepId,
  )
  // NOTE: do not allow multiple for-each steps in a flow
  if (forEachSteps.length !== 1) {
    return {
      forEachStepPosition: -1,
      stepPositions: {},
      isForEachStep,
      isLastStep: false,
      isInsideForEach: false,
    }
  }

  /**
   * stepPositions: map of step ids and their corresponding positions
   *   used in for-each to determine whether the variable is from an action before the for-each step
   *   or within the for-each loop.
   *   if variables are from steps within the loop, it will be used to find the specific execution step for the same iteration
   *
   * lastStepId: id of the last step in the pipe
   *   used in for each to terminate an iteration within the loop
   */
  const { stepPositions, lastStepId } = flow.steps.reduce(
    (acc, currStep) => {
      acc.stepPositions[currStep.id] = currStep.position
      // to account for MRF flows: only track the last step within the same branch
      if (
        currStep.config.approval?.branch === stepApprovalConfig?.branch &&
        currStep.config.approval?.stepId === stepApprovalConfig?.stepId &&
        currStep.position > acc.maxPosition
      ) {
        acc.maxPosition = currStep.position
        acc.lastStepId = currStep.id
      }
      return acc
    },
    {
      stepPositions: {} as Record<string, number>,
      maxPosition: -1,
      lastStepId: '',
    },
  )

  const forEachStepPosition = forEachSteps[0].position
  const isInsideForEach = stepPositions[step.id] > forEachStepPosition

  return {
    forEachStepPosition,
    stepPositions,
    isForEachStep,
    isLastStep: lastStepId === step.id,
    isInsideForEach,
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
    executionStepMetadata: metadata,
    forEachStepPosition,
    stepPositions,
  } = forEachContext || {}

  // SPECIAL CASE: this returns the total number of items that the for each step is processing.
  // return early as it is part of the for each data field and does not need additional computation
  if (keyPath === 'iterations') {
    return get(data, keyPath) ?? 0
  }

  let dataValue: IJSONValue = keyPath
  let forEachKeyPath = get(data, keyPath)

  // SPECIAL CASE: this returns the iteration number of the specific iteration.
  // metadata.iteration is not available for test runs
  if (forEachKeyPath === FOR_EACH_ITERATION_KEY) {
    return metadata?.iteration ? metadata.iteration : 1
  }

  const currentStepPosition = stepPositions?.[executionStep?.stepId] || -1

  forEachKeyPath = String(forEachKeyPath).replace(
    FOR_EACH_ITERATION_KEY,
    // test runs will not have metadata.iteration, and defaults to the first iteration
    String(metadata?.iteration ? metadata.iteration - 1 : 0),
  )

  if (
    executionStep?.appKey === TOOLBOX_APP_KEY &&
    executionStep?.key === TOOLBOX_ACTIONS.FOR_EACH
  ) {
    dataValue = get(data, forEachKeyPath as string) ?? ''
  } else if (currentStepPosition > forEachStepPosition) {
    // find the specific execution step for the same iteration
    const iterationExecutionStep = executionSteps.find(
      (es) =>
        es.stepId === stepId && es.metadata.iteration === metadata?.iteration,
    )
    dataValue = get(iterationExecutionStep?.dataOut, keyPath) ?? ''
  }

  return dataValue
}
