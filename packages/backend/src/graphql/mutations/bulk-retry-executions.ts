import logger from '@/helpers/logger'
import actionQueue from '@/queues/action'

import type { MutationResolvers } from '../__generated__/types.generated'

const bulkRetryExecutions: MutationResolvers['bulkRetryExecutions'] = async (
  _parent,
  params,
  context,
) => {
  // Fetch failed executions along with their latest execution step. Since we
  // run steps serially, latest execution step in a failed execution has to be
  // the one that failed.
  const failedExecutions = await context.currentUser
    .$relatedQuery('executions')
    .where('flow_id', params.input.flowId)
    .where('test_run', false)
    .where('executions.status', 'failure')
    .withGraphJoined({ executionSteps: true })
    .orderBy([
      { column: 'executions.id' },
      { column: 'executionSteps:created_at', order: 'desc' },
    ])
    .distinctOn('executions.id')

  // For each failed execution, retry the latest step (if its a failure).
  const promises = failedExecutions.map(async (execution) => {
    const executionStep = execution.executionSteps[0]
    const { jobId, status } = executionStep

    // Sanity check
    if (status !== 'failure') {
      logger.error(
        'Latest execution step is not failed for a failed execution',
        {
          event: 'bulk-retry-step-status-mismatch',
          executionId: execution.id,
          executionStepId: executionStep.id,
        },
      )

      return null
    } else {
      logger.info('Bulk retrying execution step', {
        event: 'bulk-retry-step-start',
        executionId: execution.id,
        executionStepId: executionStep.id,
      })
    }

    const job = await actionQueue.getJob(jobId)
    if (!job) {
      // if job cannot be found anymore, remove the job id from the execution step so it cannot be retried again
      await executionStep.$query().patch({ jobId: null })
      throw new Error(
        `Job for ${execution.id}-${executionStep.id} not found or has expired`,
      )
    }

    await job.retry()
    await execution.$query().patch({ status: null })
  })

  const retryAttempts = await Promise.allSettled(promises)

  const allSuccessfullyRetried = !retryAttempts.find(
    (attempt) => attempt.status === 'rejected',
  )

  // Actually we can do some more processing to see which IDs failed but nvm.
  if (!allSuccessfullyRetried) {
    logger.warn('Some attempts in bulk execution retry failed', {
      event: 'bulk-retry-some-attempts-failed',
      flowId: params.input.flowId,
    })
  }

  return {
    numFailedExecutions: failedExecutions.length,
    allSuccessfullyRetried,
  }
}

export default bulkRetryExecutions
