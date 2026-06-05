import type { IActionJobData } from '@plumber/types'

import {
  type JobPro,
  UnrecoverableError,
  type WorkerPro,
} from '@taskforcesh/bullmq-pro'
import { type Span } from 'dd-trace'

import { handleFailedStepAndThrow } from '@/helpers/actions'
import { DEFAULT_JOB_OPTIONS } from '@/helpers/default-job-configuration'
import delayAsMilliseconds from '@/helpers/delay-as-milliseconds'
import Execution from '@/models/execution'
import ExecutionStep from '@/models/execution-step'
import Step from '@/models/step'
import { enqueueActionJob } from '@/queues/action'
import type { processAction } from '@/services/action'

import processForEachStatus from './for-each-status-manager'

/**
 * The subset of a `processAction` result that `advanceAfterStep` (helper D)
 * consumes. Deliberately narrower than the full `processAction` return so the
 * batch worker (Phase 4) can hand D exactly the fields its per-job `B`/`C`
 * helpers produce, without synthesising the fields D never reads (`stepId`,
 * `computedParameters`). `processAction`'s return structurally satisfies it, so
 * the single-job call site is unchanged.
 */
type AdvanceAfterStepInput = Pick<
  Awaited<ReturnType<typeof processAction>>,
  | 'flowId'
  | 'executionId'
  | 'nextStep'
  | 'executionStep'
  | 'nextStepMetadata'
  | 'executionError'
>

/**
 * Helper D — worker post-step advancement, shared by the single-job worker and
 * (later) the batch worker. Given a completed `processAction` result and the
 * worker/job context, it either:
 *   - on a failed step: patches the for-each iteration to 'failure' (so the
 *     for-each does not hang) and routes the error through
 *     `handleFailedStepAndThrow` (which throws / re-queues); or
 *   - on success with no next step: resolves the for-each status and, when the
 *     execution is complete, marks it 'success'; or
 *   - on success with a next step: enqueues that next step.
 *
 * It throws in exactly the same cases as before (failed step, failed enqueue),
 * so the worker processor's control flow is unchanged.
 */
export async function advanceAfterStep({
  processResult,
  currStep,
  context,
}: {
  processResult: AdvanceAfterStepInput
  currStep: Step
  context: {
    isQueueDelayable: boolean
    span: Span
    worker: WorkerPro<IActionJobData>
    job: JobPro<IActionJobData>
  }
}): Promise<void> {
  const {
    flowId,
    executionId,
    nextStep,
    executionStep,
    nextStepMetadata,
    executionError,
  } = processResult
  const { isQueueDelayable, span, worker, job } = context

  if (executionStep.isFailed) {
    if (nextStepMetadata?.iteration) {
      await ExecutionStep.patchIterationStatus(
        executionId,
        nextStepMetadata.iteration,
        'failure',
      )
    }
    return handleFailedStepAndThrow({
      errorDetails: executionStep.errorDetails,
      executionError,
      context: {
        isQueueDelayable,
        worker,
        span,
        job,
      },
    })
  }

  if (!nextStep) {
    const shouldContinue = await processForEachStatus({
      executionId,
      currStep,
      nextStepMetadata,
    })

    if (!shouldContinue) {
      return
    }

    await Execution.setStatus(executionId, 'success')
    return
  }

  const jobName = `${executionId}-${nextStep.id}`

  const jobPayload = {
    flowId,
    executionId,
    stepId: nextStep.id,
    metadata: nextStepMetadata,
  }

  let jobOptions = DEFAULT_JOB_OPTIONS

  if (currStep.appKey === 'delay') {
    jobOptions = {
      ...DEFAULT_JOB_OPTIONS,
      delay: delayAsMilliseconds(currStep.key, executionStep.dataOut),
    }
  }

  try {
    await enqueueActionJob({
      appKey: nextStep.appKey,
      jobName,
      jobData: jobPayload,
      jobOptions,
    })
  } catch (error) {
    // Don't retry if we failed to enqueue the next step (e.g. if
    // getGroupConfigForJob throws an error)
    throw new UnrecoverableError(error.message)
  }
}
