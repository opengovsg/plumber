import type { IActionJobData, IAppQueue } from '@plumber/types'

import {
  Job,
  JobPro,
  WorkerPro,
  type WorkerProOptions,
} from '@taskforcesh/bullmq-pro'

import appConfig from '@/config/app'
import { BATCH_RUN_FUNCTIONS, QUEUE_BATCH_SIZE } from '@/config/batches'
import { createRedisClient } from '@/config/redis'
import { WORKER_CONCURRENCY } from '@/config/workers'
import { exponentialBackoffWithJitter } from '@/helpers/backoff'
import logger from '@/helpers/logger'
import tracer from '@/helpers/tracer'

import { handleFailedActionJob } from './handle-failed-action-job'
import { processBatchActionJob } from './process-batch-action-job'
import { processSingleActionJob } from './process-single-action-job'

function convertParamsToBullMqOptions(
  params: MakeActionWorkerParams,
) /* inferred type */ {
  const { appKey, queueName, redisConnectionPrefix, queueConfig } = params
  const { isQueueDelayable, queueRateLimit } = queueConfig

  const concurrency =
    WORKER_CONCURRENCY[appKey as keyof typeof WORKER_CONCURRENCY] ||
    appConfig.workerActionConcurrency

  // Always default to 1 if no batch size is set for the queue
  const batchSize =
    QUEUE_BATCH_SIZE[appKey as keyof typeof QUEUE_BATCH_SIZE] || 1

  const workerOptions: WorkerProOptions = {
    connection: createRedisClient(),
    concurrency,
    settings: {
      backoffStrategy: exponentialBackoffWithJitter,
    },
    batch: {
      size: batchSize,
    },
  }

  if (redisConnectionPrefix) {
    workerOptions.prefix = redisConnectionPrefix
  }

  if (queueRateLimit) {
    workerOptions.limiter = queueRateLimit
  }

  let groupSettings: WorkerProOptions['group'] | null = null
  if (queueConfig.groupLimits) {
    const { groupLimits } = queueConfig

    switch (groupLimits.type) {
      case 'concurrency':
        groupSettings = { concurrency: groupLimits.concurrency }
        break
      case 'rate-limit':
        groupSettings = { limit: groupLimits.limit }
        break
    }
  }
  if (groupSettings) {
    workerOptions.group = groupSettings
  }

  return {
    queueName,
    workerOptions,
    isQueueDelayable,
  }
}

interface MakeActionWorkerParams {
  appKey: string
  queueName: string
  redisConnectionPrefix?: string
  queueConfig: IAppQueue
}

export interface BullMqOptions {
  queueName: string
  workerOptions: WorkerProOptions
  isQueueDelayable: boolean
}

function splitOnLastDelimiter(str: string, delimiter: string) {
  const lastIndex = str.lastIndexOf(delimiter)

  if (lastIndex === -1) {
    // Delimiter not found, return the original string
    return str
  } else {
    // Return the part of the string before the last delimiter
    return str.substring(0, lastIndex)
  }
}

/**
 * Creates a worker for an action queue.
 *
 * To keep complexity managable, we enforce that all action queue workers use
 * the same worker processor / callback - hence this function.
 */
export function makeActionWorker(
  params: MakeActionWorkerParams,
): WorkerPro<IActionJobData> {
  const { queueName, workerOptions, isQueueDelayable } =
    convertParamsToBullMqOptions(params)
  const worker: WorkerPro<IActionJobData> = new WorkerPro<IActionJobData>(
    queueName,
    tracer.wrap(
      // Fix trace service name to workers.action regardless of queue name, so
      // that we can more easily monitor all actions.
      'workers.action',
      async (batchedJob: JobPro<IActionJobData>) => {
        const jobsInBatch = batchedJob.getBatch()

        // perform batching for queues that support it, right now only M365 queue supports it
        if (jobsInBatch && jobsInBatch.length > 1) {
          /**
           * Proceed with batching only after checking if the batchJob function exists for the specific action in the app e.g. M365 createTableRow
           * This is done by obtaining the first part of the group id
           */
          const firstJob = jobsInBatch[0]
          const firstJobOptions = firstJob.opts
          const groupID = firstJobOptions.group.id
          const appActionKey = splitOnLastDelimiter(groupID, '_')
          if (appActionKey in BATCH_RUN_FUNCTIONS) {
            const batchFunction = BATCH_RUN_FUNCTIONS[appActionKey]
            // use the batch job timestamp as a source of truth when logging
            const batchJobTimestamp = new Date(
              batchedJob.timestamp,
            ).toISOString()

            await processBatchActionJob({
              jobsInBatch,
              worker,
              bullMqOptions: { queueName, workerOptions, isQueueDelayable },
              batchJobTimestamp,
              batchFunction,
            })
          } else {
            /**
             * This will be the logic for actions in a queue that does not support batching e.g. M365 queue allows batching for createTableRow but not for other actions.
             *
             * If the action does not allow batching, handle each job in the batch individually as if there was no batching. Mark the individual jobs as failed to not fail the wrapped batch job. The progress object is used to get the error later to handle it.
             */
            for (const job of jobsInBatch) {
              try {
                await processSingleActionJob(job, worker, {
                  queueName,
                  workerOptions,
                  isQueueDelayable,
                })
              } catch (err) {
                job.updateProgress(err)
                job.setAsFailed(err)
              }
            }
          }
          return // need to return here to avoid processing the single job
        }

        // proceed with single job in the batch as per normal
        const singleJob = jobsInBatch[0]
        await processSingleActionJob(singleJob, worker, {
          queueName,
          workerOptions,
          isQueueDelayable,
        })
      },
    ),
    workerOptions,
  )

  worker.on('active', (batchedJob: JobPro<IActionJobData>) => {
    const jobsInBatch = batchedJob.getBatch()
    if (jobsInBatch && jobsInBatch.length > 1) {
      logger.info(`[${queueName}] JOB IDs: ${batchedJob.id} have started!`, {
        queueName,
        batchJobTimestamp: new Date(batchedJob.timestamp).toISOString(),
        jobsData: jobsInBatch.map((subJob: Job) => ({
          ...subJob.data,
          jobId: subJob.id,
        })),
        workerVersion: appConfig.version,
      })
    } else {
      const singleJob = jobsInBatch[0]
      logger.info(
        `[${queueName}] JOB ID: ${singleJob.id} - FLOW ID: ${singleJob.data.flowId} has started!`,
        {
          queueName,
          job: singleJob.data,
          workerVersion: appConfig.version,
        },
      )
    }
  })

  worker.on('completed', (batchedJob: JobPro<IActionJobData>) => {
    const jobsInBatch = batchedJob.getBatch()
    if (jobsInBatch && jobsInBatch.length > 1) {
      // track each individual job for failure and log it
      const failedJobsInBatch = jobsInBatch.filter(
        (subJob: Job) => subJob.failedReason,
      )
      const completedJobsInBatch = jobsInBatch.filter(
        (subJob: Job) => !subJob.failedReason,
      )
      if (failedJobsInBatch.length > 0) {
        // Log general batch info first for failed jobs
        logger.info(
          `[${queueName}] JOB IDs: ${failedJobsInBatch
            .map((subJob: Job) => subJob.id)
            .join(',')} have failed!`,
          {
            queueName,
            batchJobTimestamp: new Date(batchedJob.timestamp).toISOString(),
            jobsData: failedJobsInBatch.map((subJob: Job) => ({
              ...subJob.data,
              jobId: subJob.id,
            })),
            workerVersion: appConfig.version,
          },
        )

        // Handle each failed job individually
        for (const failedJob of failedJobsInBatch) {
          // Note: the Error object is private and not retrievable so we need to use the progress object to get the error to handle it
          handleFailedActionJob(
            failedJob,
            queueName,
            failedJob.progress as Error,
          )
        }
      }

      if (completedJobsInBatch.length > 0) {
        logger.info(
          `[${queueName}] JOB IDs: ${completedJobsInBatch
            .map((subJob: Job) => subJob.id)
            .join(',')} have completed!`,
          {
            queueName,
            batchJobTimestamp: new Date(batchedJob.timestamp).toISOString(),
            jobsData: completedJobsInBatch.map((subJob: Job) => ({
              ...subJob.data,
              jobId: subJob.id,
            })),
            workerVersion: appConfig.version,
          },
        )
      }
    } else {
      const singleJob = jobsInBatch[0]
      logger.info(
        `[${queueName}] JOB ID: ${singleJob.id} - FLOW ID: ${singleJob.data.flowId} has completed!`,
        {
          queueName,
          job: singleJob.data,
          workerVersion: appConfig.version,
        },
      )
    }
  })

  worker.on('failed', async (batchedJob: JobPro<IActionJobData>, err) => {
    const jobsInBatch = batchedJob.getBatch()
    // This occurs when the wrapped batch job fails
    if (jobsInBatch && jobsInBatch.length > 1) {
      logger.error(`[${queueName}] JOB IDs: ${batchedJob.id} have failed!`, {
        err,
        queueName,
        batchJobTimestamp: new Date(batchedJob.timestamp).toISOString(),
        jobsData: jobsInBatch.map((subJob: Job) => ({
          ...subJob.data,
          jobId: subJob.id,
          failedReason: subJob.failedReason,
        })),
        workerVersion: appConfig.version,
      })
      return
    } else {
      // handle single job failure as usual
      const singleJob = jobsInBatch[0]
      handleFailedActionJob(singleJob, queueName, err)
    }
  })

  worker.on('ready', () => {
    logger.info(`[${queueName}] Worker is ready!`)
  })

  worker.on('closed', () => {
    logger.info(`[${queueName}] Worker is closed!`)
  })

  worker.on('error', (err) => {
    if (!err) {
      logger.error(`[${queueName}] Worker had undefined error`)
      return
    }
    // catch-all just in case any errors bubble up and potentially crash the worker task
    logger.error(`[${queueName}] Worker errored with ${err.message}`, {
      err: err.stack,
      queueName,
    })
  })

  return worker
}
