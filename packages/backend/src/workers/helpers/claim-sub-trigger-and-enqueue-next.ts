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

type ClaimResult =
  | 'missing'
  | { kind: 'claimed'; id: string }
  | { kind: 'already'; id: string }

/**
 * Marks the sub-trigger execution step successful, then enqueues the next job.
 *
 * IMPORTANT: Enqueue only after the success commit. A Redis job can start
 * before an in-transaction patch is visible, so the next step would miss
 * this step's dataOut.
 *
 * A retried worker still enqueues if the row is already successful. A crash
 * after commit would otherwise stall with no next job, which is harder to
 * recover than a possible duplicate run. A stable job id keeps a second add
 * from starting another run while the first job is still in Redis.
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
      return 'missing' satisfies ClaimResult
    }

    if (executionStep.status === 'success') {
      logger.debug({
        event: 'sub-trigger-execution-step-already-succeeded',
        executionId,
        stepId,
        executionStepId: executionStep.id,
      })
      return { kind: 'already', id: executionStep.id } satisfies ClaimResult
    }

    const updated = await executionStep
      .$query(trx)
      .patchAndFetch({ status: 'success' })
    return { kind: 'claimed', id: updated.id } satisfies ClaimResult
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
        // BullMQ ignores an add whose id already exists. That covers a retry
        // that races the first enqueue, or a Redis error that actually landed.
        jobId: `${jobPayload.executionId}-${jobPayload.stepId}`,
      },
    })
  } catch (error) {
    if (claimed.kind === 'claimed') {
      await ExecutionStep.query().findById(claimed.id).patch({ status: null })
    }
    throw error
  }
}
