import { ref } from 'objection'

import Execution from '@/models/execution'
import ExecutionStep from '@/models/execution-step'
import { getActionJob } from '@/queues/action'

import type { MutationResolvers } from '../__generated__/types.generated'

const retryExecutionStep: MutationResolvers['retryExecutionStep'] = async (
  _parent,
  params,
  context,
) => {
  const executionStep = await ExecutionStep.query()
    .findById(params.input.executionStepId)
    .whereNotNull('job_id')
    .where('status', 'failure')
    .whereExists(
      context.currentUser
        .withAccessibleExecutions({ requiredRole: 'editor' })
        .select(1)
        .where('executions.id', ref('execution_steps.execution_id')),
    )

  if (!executionStep) {
    throw new Error('Execution step not found')
  }

  const { jobId } = executionStep
  const job = await getActionJob(jobId)
  if (!job) {
    // if job cannot be found anymore, remove the job id from the execution step so it cannot be retried again
    await executionStep.$query().patch({ jobId: null })
    throw new Error('Job not found or has expired')
  }

  const originalJobData = job.data
  await job.updateData({ ...originalJobData, retryQueuedAt: Date.now() })
  try {
    await job.retry()
  } catch (err) {
    // job.retry() throws if the job isn't actually in the terminal "failed"
    // state (e.g. it's still sitting in BullMQ's own delayed/backoff state from
    // an earlier attempt - ExecutionStep gets a status:'failure' row on every
    // failed attempt, not just the terminal one, so a human can race this).
    // Revert the stamp so we don't pollute telemetry for a retry that never
    // took effect.
    await job.updateData(originalJobData)
    throw err
  }
  // allow for status to change to null in case there are delay actions after
  await Execution.query()
    .patch({ status: null })
    .findById(executionStep.executionId)

  if (executionStep.metadata?.iteration) {
    // set the iteration's state to null (waiting)
    await ExecutionStep.patchIterationStatus(
      executionStep.executionId,
      executionStep.metadata.iteration,
      null,
    )
  }

  return true
}

export default retryExecutionStep
