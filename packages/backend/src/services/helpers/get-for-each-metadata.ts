import { IActionRunResult, IJSONObject, NextStepMetadata } from '@plumber/types'

import { FOR_EACH_MAX_ITERATIONS } from '@/apps/toolbox/common/constants'
import { ForEachContext } from '@/helpers/compute-for-each-parameters'

export default function getForEachMetadata({
  forEachContext,
  metadata,
  dataOut,
  runResult,
}: {
  forEachContext: ForEachContext
  metadata: NextStepMetadata
  dataOut: IJSONObject
  runResult: IActionRunResult
}) {
  const { forEachStepPosition, isForEachStep } = forEachContext

  /**
   * SPECIAL CASE
   * these are the instances where this is needed:
   * 1. if-then
   *    when there are if-then actions in the for-each, not all steps may run so the lastStep check may not work
   *    if-then uses stop-execution to terminate the flow, so we need to set the isLastStep to true
   *    so that the execution status is set to success
   * 2. only continue if
   *    it uses stop-execution to terminate the flow, so we need to set the isLastStep to true
   *    so that the execution status is set to success
   * 3. when there are no iterations to run.
   *    terminate the flow at the for-each step and mark as success immediately
   */
  if (
    forEachStepPosition > -1 &&
    runResult.nextStep?.command === 'stop-execution' &&
    metadata
  ) {
    metadata.isLastStep = true
  }

  if (isForEachStep) {
    const iterations = Math.min(
      FOR_EACH_MAX_ITERATIONS,
      Number(dataOut?.iterations ?? 0),
    )

    // create object to track status of each iteration
    // set default status to null so that we have a 'waiting' status
    if (iterations && iterations > 0) {
      metadata.iterations = iterations
      metadata.iterationStatus = {}
      for (let i = 0; i < iterations; i++) {
        metadata.iterationStatus[`iteration_${i + 1}`] = null
      }
    }
  }
}
