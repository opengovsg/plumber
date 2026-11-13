import Execution from '@/models/execution'
import ExecutionStep from '@/models/execution-step'

import { patchIterationStatusFromSteps } from './for-each-status-manager'

/**
 * Re-derives the execution's final status after a step re-ran on its own.
 *
 * The rest of the execution already finished, so no later step will settle it.
 */
export async function settleExecutionAfterSingleStep(
  executionId: string,
  iteration: number | undefined,
): Promise<void> {
  if (iteration) {
    await patchIterationStatusFromSteps(executionId, iteration)
  }

  const haveSucceeded =
    await ExecutionStep.haveLatestStepsSucceeded(executionId)
  await Execution.setStatus(executionId, haveSucceeded ? 'success' : 'failure')
}
