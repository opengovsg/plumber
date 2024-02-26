import { ref } from 'objection'

import Execution from '@/models/execution'
import ExecutionStep from '@/models/execution-step'
import actionQueue from '@/queues/action'

import type { MutationResolvers } from '../__generated__/types.generated'

const retryExecutionStep: NonNullable<
  MutationResolvers['retryExecutionStep']
> = async (_parent, params, context) => {
  const executionStep = await ExecutionStep.query()
    .findById(params.input.executionStepId)
    .whereNotNull('job_id')
    .where('status', 'failure')
    .whereExists(
      context.currentUser
        .$relatedQuery('executions')
        .select(1)
        .where('executions.id', ref('execution_steps.execution_id')),
    )

  if (!executionStep) {
    throw new Error('Execution step not found')
  }

  const { jobId } = executionStep
  const job = await actionQueue.getJob(jobId)
  if (!job) {
    // if job cannot be found anymore, remove the job id from the execution step so it cannot be retried again
    await executionStep.$query().patch({ jobId: null })
    throw new Error('Job not found or has expired')
  }
  await job.retry()
  // allow for status to change to null in case there are delay actions after
  await Execution.query()
    .patch({ status: null })
    .findById(executionStep.executionId)
  return true
}

export default retryExecutionStep
