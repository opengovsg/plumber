import { IExecutionStepMetadata } from '@plumber/types'

import {
  TOOLBOX_ACTIONS,
  TOOLBOX_APP_KEY,
} from '@/apps/toolbox/common/constants'
import logger from '@/helpers/logger'
import Execution from '@/models/execution'
import ExecutionStep from '@/models/execution-step'
import Step from '@/models/step'

/**
 * this function helps to patch the execution status of steps in a pipe with for-each
 * it returns a boolean to decide whether to set the execution status to success
 */
export default async function processForEachStatus({
  executionId,
  currStep,
  nextStepMetadata,
}: {
  executionId: string
  currStep: Step
  nextStepMetadata: IExecutionStepMetadata
}): Promise<boolean> {
  const isForEach =
    currStep?.appKey === TOOLBOX_APP_KEY &&
    currStep?.key === TOOLBOX_ACTIONS.FOR_EACH

  const { isLastIteration, isLastStep, iteration } = nextStepMetadata ?? {}

  /**
   * nextStep is always null for the for-each execution step,
   * return early so that we do not prematurely set the execution status to success
   * and it can be reflected accurately as waiting.
   *
   * if there are no iterations, the nextStepMetadata isLastStep will be set to true
   * to signal that this is the end of the execution.
   */
  if (isForEach && !isLastStep) {
    return false
  }

  if (iteration) {
    /**
     * default state is null (waiting for all iterations to execute)
     * if any iteration fails, the execution is immediately set to failure
     * if all iterations are successful, the execution is set to success
     */
    // only need to check at the last step to set the execution status
    if (isLastStep) {
      try {
        await ExecutionStep.patchIterationStatus(
          executionId,
          iteration,
          'success',
        )
      } catch (err) {
        logger.error('Failed to patch iteration status', {
          err,
          executionId,
          iteration,
        })
      }

      const { hasLastIterationRun, areAllStepsSuccessful } =
        await ExecutionStep.getForEachExecutionState(executionId)

      // signals end of the execution: all iterations ran successfully up to the last iteration and last step
      if (isLastIteration) {
        if (!areAllStepsSuccessful) {
          await Execution.setStatus(executionId, 'failure')
          return false // Status was set to failure
        }
      }

      // if the last iteration has not run, it means this flow is still executing
      // we return early to preserve the waiting state of the execution
      if (!hasLastIterationRun) {
        return false // No status was set, still waiting
      }

      // if all steps are successful, return to let the action worker set to success
      if (!areAllStepsSuccessful) {
        await Execution.setStatus(executionId, 'failure')
        return false
      }
    } else {
      return false // No status was set
    }
  }

  return true
}
