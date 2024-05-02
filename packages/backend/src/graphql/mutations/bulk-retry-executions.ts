import logger from '@/helpers/logger'
import Execution from '@/models/execution'
import ExecutionStep from '@/models/execution-step'
import actionQueue from '@/queues/action'

import type { MutationResolvers } from '../__generated__/types.generated'

const SEVEN_DAYS_IN_MS = 7 * 24 * 60 * 60 * 1000

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
    .where('executions.flow_id', params.input.flowId)
    .where('executions.test_run', false)
    .where('executions.status', 'failure')
    .where(
      'executions.created_at',
      '>=',
      new Date(Date.now() - SEVEN_DAYS_IN_MS).toISOString(),
    )
    .select('executions.id')
  let latestFailedExecutionSteps = await ExecutionStep.query()
    .whereIn(
      'execution_id',
      failedExecutions.map((e) => e.id),
    )
    .orderBy([
      { column: 'execution_id' },
      { column: 'created_at', order: 'desc' },
    ])
    .distinctOn('execution_id')
    .select('execution_id', 'status', 'job_id')

  // Double check that latest steps for each failed execution is a failure and
  // has a valid job ID.
  latestFailedExecutionSteps = latestFailedExecutionSteps.filter(
    (executionStep) => {
      const { id: executionStepId, executionId, status, jobId } = executionStep
      if (status !== 'failure') {
        logger.error(
          'Latest execution step is not failed for a failed execution',
          {
            event: 'bulk-retry-step-status-mismatch',
            executionId: executionId,
            executionStepId: executionStepId,
          },
        )
        return false
      }
      if (jobId === null || jobId === undefined) {
        // For fresh per-app queues, job ID can be 0.
        logger.error('Latest execution step does not have a job ID', {
          event: 'bulk-retry-step-no-job-id',
          executionId: executionId,
          executionStepId: executionStepId,
        })
        return false
      }
      return true
    },
  )

  // Nothing to do if no steps to retry
  if (latestFailedExecutionSteps.length === 0) {
    return {
      numFailedExecutions: 0,
      allSuccessfullyRetried: true,
    }
  }

  // For each failed execution, retry the latest step.
  const promises = latestFailedExecutionSteps.map(async (executionStep) => {
    const { id: executionStepId, executionId, jobId } = executionStep

    logger.info('Bulk retrying execution step', {
      event: 'bulk-retry-step-start',
      executionId: executionId,
      executionStepId: executionStepId,
    })

    const job = await actionQueue.getJob(jobId)
    if (!job) {
      // if job cannot be found anymore, remove the job id from the execution step so it cannot be retried again
      await executionStep.$query().patch({ jobId: null })
      throw new Error(
        `Job for ${executionId}-${executionStepId} not found or has expired`,
      )
    }

    await job.retry()
    await Execution.query().findById(executionId).patch({ status: null })
  })
  const retryAttempts = await Promise.allSettled(promises)

  const allSuccessfullyRetried = !retryAttempts.find(
    (attempt) => attempt.status === 'rejected',
  )

  if (!allSuccessfullyRetried) {
    // Actually we can do some more processing to see which IDs failed but nvm.
    logger.warn('Some attempts in bulk execution retry failed', {
      event: 'bulk-retry-some-attempts-failed',
      flowId: params.input.flowId,
    })
  } else {
    logger.info('Bulk execution retry succeeded', {
      event: 'bulk-retry-success',
      flowId: params.input.flowId,
      numRetried: latestFailedExecutionSteps.length,
    })
  }

  return {
    numFailedExecutions: latestFailedExecutionSteps.length,
    allSuccessfullyRetried,
  }
}

export default bulkRetryExecutions
