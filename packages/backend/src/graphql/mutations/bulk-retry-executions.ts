import { chunk } from 'lodash'

import { DEFAULT_JOB_OPTIONS } from '@/helpers/default-job-configuration'
import logger from '@/helpers/logger'
import Execution from '@/models/execution'
import ExecutionStep from '@/models/execution-step'
import ExtendedQueryBuilder from '@/models/query-builder'
import actionQueue from '@/queues/action'

import type { MutationResolvers } from '../__generated__/types.generated'

const SEVEN_DAYS_IN_MS = 7 * 24 * 60 * 60 * 1000
const CHUNK_SIZE = 100

// Fetch failed executions along with their latest execution step. Since we
// run steps serially, latest execution step in a failed execution has to be
// the one that failed.
async function getAllFailedExecutionSteps(
  root: ExtendedQueryBuilder<Execution, Execution[]>,
  flowId: string,
) {
  const failedExecutions = await root
    .where('executions.flow_id', flowId)
    .where('executions.test_run', false)
    .where((builder) =>
      builder
        .where('executions.status', 'failure')
        .orWhereNull('executions.status'),
    )
    .where(
      'executions.created_at',
      '>=',
      new Date(Date.now() - SEVEN_DAYS_IN_MS).toISOString(),
    )
    .select('executions.id')
  return await ExecutionStep.query()
    .whereIn(
      'execution_id',
      failedExecutions.map((e) => e.id),
    )
    .orderBy([
      { column: 'execution_id' },
      { column: 'created_at', order: 'desc' },
    ])
    .distinctOn('execution_id')
    .select('id', 'execution_id', 'status', 'job_id')
}

const bulkRetryExecutions: MutationResolvers['bulkRetryExecutions'] = async (
  _parent,
  params,
  context,
) => {
  let latestFailedExecutionSteps: ExecutionStep[] = []
  // Admin usage only
  if (context.currentUser.email === 'plumber@open.gov.sg') {
    if (params.input.executionIds) {
      latestFailedExecutionSteps = await ExecutionStep.query()
        .findByIds(params.input.executionIds)
        .orderBy([
          { column: 'execution_id' },
          { column: 'created_at', order: 'desc' },
        ])
        .distinctOn('execution_id')
        .select('id', 'execution_id', 'status', 'job_id')
    } else if (params.input.flowId) {
      latestFailedExecutionSteps = await getAllFailedExecutionSteps(
        Execution.query(),
        params.input.flowId,
      )
    }
  } else {
    latestFailedExecutionSteps = await getAllFailedExecutionSteps(
      context.currentUser.$relatedQuery('executions'),
      params.input.flowId,
    )
  }

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
  const retryAttempts: PromiseSettledResult<void>[] = []
  const chunkedSteps = chunk(latestFailedExecutionSteps, CHUNK_SIZE)
  for (const currChunk of chunkedSteps) {
    const promises = currChunk.map(async (executionStep) => {
      const { id: executionStepId, executionId, jobId } = executionStep

      const job = await actionQueue.getJob(jobId)
      if (!job) {
        // if job cannot be found anymore, remove the job id from the execution step so it cannot be retried again
        await executionStep.$query().patch({ jobId: null })
        logger.error('Bulk retrying execution step - no job', {
          event: 'bulk-retry-step-no-job',
          oldJobId: jobId,
        })
        throw new Error(
          `Job for ${executionId}-${executionStepId} not found or has expired`,
        )
      }

      try {
        const jobState = await job.getState()
        if (jobState !== 'failed') {
          logger.warn('Bulk retrying execution step - job not failed', {
            event: 'bulk-retry-step-job-not-failed',
            executionId: executionId,
            executionStepId: executionStepId,
            jobId: jobId,
            jobState,
          })
          throw new Error(
            `Job for ${executionId}-${executionStepId} (JOB: ${jobId}) is not in a failed state`,
          )
        }
      } catch (error) {
        logger.error('Bulk retrying execution step - job get state error', {
          event: 'bulk-retry-step-job-getstate-error',
          oldJobData: job.data,
          oldJobId: job.id,
          error,
        })

        throw error
      }

      logger.info('Bulk retrying execution step - start', {
        event: 'bulk-retry-step-start',
        oldJobData: job.data,
        oldJobId: job.id,
      })

      try {
        await job.remove()
        const newJob = await actionQueue.add(
          job.name,
          job.data,
          DEFAULT_JOB_OPTIONS,
        )
        await Execution.query().findById(executionId).patch({ status: null })
        await executionStep.$query().patch({ jobId: newJob.id })

        logger.info('Bulk retrying execution step - done', {
          event: 'bulk-retry-step-done',
          oldJobData: job.data,
          oldJobId: job.id,
          newJobId: newJob.id,
        })
      } catch (error) {
        logger.error('Bulk retrying execution step - ERROR', {
          event: 'bulk-retry-step-failed',
          oldJobData: job.data,
          oldJobId: job.id,
          error,
        })

        throw error
      }
    })
    const currRetryAttempts = await Promise.allSettled(promises)
    retryAttempts.push(...currRetryAttempts)
  }

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
