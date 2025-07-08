import { chunk } from 'lodash'
import { raw, ref } from 'objection'

import { DEFAULT_JOB_OPTIONS } from '@/helpers/default-job-configuration'
import logger from '@/helpers/logger'
import Execution from '@/models/execution'
import ExecutionStep from '@/models/execution-step'
import { enqueueActionJob, getActionJob } from '@/queues/action'
import Context from '@/types/express/context'

import type { MutationResolvers } from '../__generated__/types.generated'

const CHUNK_SIZE = 100

async function getAllFailedIterations(context: Context, executionId: string) {
  const failedExecutionSteps = await ExecutionStep.query()
    .with('latest_attempts', (builder) => {
      builder
        .distinctOn([raw('step_id'), raw("metadata->>'iteration'")])
        .select('*')
        .from('execution_steps')
        .where('execution_id', executionId)
        .whereExists(
          context.currentUser
            .$relatedQuery('executions')
            .select(1)
            .where('executions.id', ref('execution_steps.execution_id')),
        )
        .orderBy('step_id')
        .orderBy(raw("metadata->>'iteration'"))
        .orderBy('created_at', 'desc')
    })
    .select(
      'id',
      'execution_id',
      'step_id',
      'status',
      'job_id',
      'app_key',
      'key',
      'metadata',
    )
    .from('latest_attempts')
    .where('status', '!=', 'success')
    .withSoftDeleted()

  return failedExecutionSteps
}

const bulkRetryIterations: MutationResolvers['bulkRetryIterations'] = async (
  _parent,
  params,
  context,
) => {
  if (!params.input.executionId) {
    throw new Error('Execution ID is required')
  }

  let failedExecutionSteps = await getAllFailedIterations(
    context,
    params.input.executionId,
  )

  /**
   * NOTE: this filters out execution steps that are not failed or have no job id
   * if there is no job id, we will skip the retry
   */
  failedExecutionSteps = failedExecutionSteps.filter((executionStep) => {
    const { id: executionStepId, executionId, jobId, metadata } = executionStep

    const defaultLoggerMetadata = {
      executionId: executionId,
      executionStepId: executionStepId,
      iteration: metadata.iteration,
    }

    if (jobId === null || jobId === undefined) {
      // For fresh per-app queues, job ID can be 0.
      logger.error('Latest execution step does not have a job ID', {
        event: 'bulk-retry-iteration-step-no-job-id',
        ...defaultLoggerMetadata,
      })
      return false
    }

    return true
  })

  // Nothing to do if no steps to retry
  if (failedExecutionSteps.length === 0) {
    return {
      numFailedIterations: 0,
      allSuccessfullyRetried: true,
    }
  }

  // Retry each failed iteration
  const retryAttempts: PromiseSettledResult<void>[] = []
  const chunkedIterations = chunk(failedExecutionSteps, CHUNK_SIZE)

  for (const currChunk of chunkedIterations) {
    const promises = currChunk.map(async (executionStep) => {
      const {
        id: executionStepId,
        executionId,
        jobId,
        appKey,
        metadata,
      } = executionStep

      const defaultLoggerMetadata = {
        executionId: executionId,
        executionStepId: executionStepId,
        iteration: metadata.iteration,
      }

      const job = await getActionJob(jobId)
      if (!job) {
        // if job cannot be found anymore, remove the job id from the execution step so it cannot be retried again
        await executionStep.$query().patch({ jobId: null })
        logger.error('Bulk retrying iteration - no job', {
          event: 'bulk-retry-iteration-no-job',
          ...defaultLoggerMetadata,
          oldJobId: jobId,
        })
        throw new Error(
          `Job for ${executionId}-${executionStepId}-${metadata.iteration} not found or has expired`,
        )
      }

      try {
        const jobState = await job.getState()
        if (jobState !== 'failed') {
          logger.warn(
            `Bulk retrying iteration ${metadata.iteration} - job not failed`,
            {
              event: 'bulk-retry-iteration-job-not-failed',
              ...defaultLoggerMetadata,
              jobId: jobId,
              jobState,
            },
          )
          throw new Error(
            `Job for ${executionId}-${executionStepId}-${metadata.iteration} (JOB: ${jobId}) is not in a failed state`,
          )
        }
      } catch (error) {
        logger.error('Bulk retrying execution step - job get state error', {
          event: 'bulk-retry-iteration-job-getstate-error',
          ...defaultLoggerMetadata,
          oldJobData: job.data,
          oldJobId: job.id,
          error,
        })

        throw error
      }

      logger.info('Bulk retrying execution step - start', {
        event: 'bulk-retry-iteration-start',
        ...defaultLoggerMetadata,
        oldJobData: job.data,
        oldJobId: job.id,
      })

      try {
        await job.remove()

        const newJob = await enqueueActionJob({
          appKey: appKey,
          jobName: job.name,
          jobData: job.data,
          jobOptions: DEFAULT_JOB_OPTIONS,
        })
        await Execution.query().findById(executionId).patch({ status: null })
        await executionStep.$query().patch({ jobId: newJob.id })

        logger.info('Bulk retrying iterations - done', {
          event: 'bulk-retry-iteration-done',
          ...defaultLoggerMetadata,
          oldJobData: job.data,
          oldJobId: job.id,
          newJobId: newJob.id,
        })
      } catch (error) {
        logger.error('Bulk retrying iterations - ERROR', {
          event: 'bulk-retry-iteration-failed',
          ...defaultLoggerMetadata,
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
    logger.warn('Some attempts in bulk iteration retry failed', {
      event: 'bulk-retry-iteration-some-attempts-failed',
      executionId: params.input.executionId,
    })
  } else {
    logger.info('Bulk iteration retry succeeded', {
      event: 'bulk-retry-iteration-success',
      executionId: params.input.executionId,
      numRetried: failedExecutionSteps.length,
    })
  }

  return {
    numFailedIterations: failedExecutionSteps.length,
    allSuccessfullyRetried,
  }
}

export default bulkRetryIterations
