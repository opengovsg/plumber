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

/**
 * Marks the sub-trigger execution step successful, then enqueues the next job.
 *
 * IMPORTANT: Enqueue only after the success commit. A Redis job can start
 * before an in-transaction patch is visible, so the next step would miss
 * this step's dataOut.
 *
 * The row transitions to success exactly once under `forUpdate`, so exactly
 * one worker reaches the enqueue below.
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
      return null
    }

    if (executionStep.status === 'success') {
      logger.debug({
        event: 'sub-trigger-execution-step-already-succeeded',
        executionId,
        stepId,
        executionStepId: executionStep.id,
      })
      return null
    }

    return await executionStep.$query(trx).patchAndFetch({ status: 'success' })
  })

  if (!claimed) {
    return
  }

  try {
    await enqueueActionJob({
      appKey: nextStep.appKey ?? null,
      jobName,
      jobData: jobPayload,
      jobOptions: {
        ...DEFAULT_JOB_OPTIONS,
        // Unclaiming below lets a retry enqueue again. BullMQ ignores an add
        // whose id already exists, so a Redis error that actually landed the
        // job cannot produce a second run of this step.
        jobId: `${jobPayload.executionId}-${jobPayload.stepId}`,
      },
    })
  } catch (error) {
    await ExecutionStep.query().findById(claimed.id).patch({ status: null })
    throw error
  }
}
