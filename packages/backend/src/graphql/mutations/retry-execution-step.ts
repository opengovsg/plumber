import { ref } from 'objection'

import ExecutionStep from '@/models/execution-step'
import actionQueue from '@/queues/action'
import Context from '@/types/express/context'
import Execution from '@/models/execution'

type Params = {
  input: {
    executionStepId: string
  }
}

const retryExecutionStep = async (
  _parent: unknown,
  params: Params,
  context: Context,
) => {
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
  await Execution.query()
    .patch({ status: 'pending' })
    .findById(executionStep.executionId)
  return true
}

export default retryExecutionStep
