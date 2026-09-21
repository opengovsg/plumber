import type { IActionJobData } from '@plumber/types'

import { DEFAULT_JOB_OPTIONS } from '@/helpers/default-job-configuration'
import logger from '@/helpers/logger'
import ExecutionStep from '@/models/execution-step'
import { enqueueActionJob } from '@/queues/action'

export type ClaimSubTriggerAndEnqueueNextParams = {
  executionId: string
  stepId: string
  nextStep: {
    id: string
    appKey?: string | null
  }
  jobName: string
  jobPayload: IActionJobData
}

function isDuplicateJobError(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false
  }
  const message =
    'message' in error && typeof error.message === 'string' ? error.message : ''
  return /already exists/i.test(message) || /duplicated/i.test(message)
}

/**
 * Marks the sub-trigger execution step successful, then enqueues the next job.
 *
 * IMPORTANT: Enqueue only after the success commit. A Redis job can start
 * before an in-transaction patch is visible, so the next step would miss
 * this step's dataOut.
 *
 * A retried worker still enqueues if the row is already successful. That is
 * the same recovery as today's enqueue-then-patch path. A stable job id keeps
 * a second add from creating another job.
 */
export async function claimSubTriggerAndEnqueueNext(
  params: ClaimSubTriggerAndEnqueueNextParams,
): Promise<void> {
  const { executionId, stepId, nextStep, jobName, jobPayload } = params

  const claimed = await ExecutionStep.transaction(async (trx) => {
    const executionStep = await ExecutionStep.query(trx)
      .findOne({
        execution_id: executionId,
        step_id: stepId,
      })
      .forUpdate()

    if (!executionStep) {
      // this should never happen! but we can safely return here
      logger.warn('bug: Execution step not found', {
        event: 'sub-trigger-execution-step-not-found',
        executionId,
        stepId,
      })
      return 'missing' as const
    }

    if (executionStep.status === 'success') {
      logger.debug({
        event: 'sub-trigger-execution-step-already-succeeded',
        executionId,
        stepId,
        executionStepId: executionStep.id,
      })
      return { kind: 'already' as const, id: executionStep.id }
    }

    const updated = await executionStep
      .$query(trx)
      .patchAndFetch({ status: 'success' })
    return { kind: 'claimed' as const, id: updated.id }
  })

  if (claimed === 'missing') {
    return
  }

  try {
    await enqueueActionJob({
      appKey: nextStep.appKey ?? null,
      jobName,
      jobData: jobPayload,
      jobOptions: {
        ...DEFAULT_JOB_OPTIONS,
        jobId: `${jobPayload.executionId}-${jobPayload.stepId}`,
      },
    })
  } catch (error) {
    if (isDuplicateJobError(error)) {
      return
    }
    if (claimed.kind === 'claimed') {
      await ExecutionStep.query().findById(claimed.id).patch({ status: null })
    }
    throw error
  }
}
