import type {
  IActionJobData,
  IAppQueue,
  IGlobalVariable,
  NextStepMetadata,
} from '@plumber/types'

import {
  UnrecoverableError,
  WorkerPro,
  type WorkerProOptions,
} from '@taskforcesh/bullmq-pro'

import appConfig from '@/config/app'
import { BATCH_RUN_FUNCTIONS } from '@/config/batches'
import { createRedisClient } from '@/config/redis'
import { WORKER_CONCURRENCY } from '@/config/workers'
import { handleFailedStepAndThrow } from '@/helpers/actions'
import { exponentialBackoffWithJitter } from '@/helpers/backoff'
import { ForEachContext } from '@/helpers/compute-for-each-parameters'
import {
  DEFAULT_JOB_OPTIONS,
  MAXIMUM_JOB_ATTEMPTS,
} from '@/helpers/default-job-configuration'
import delayAsMilliseconds from '@/helpers/delay-as-milliseconds'
import {
  isErrorEmailAlreadySent,
  sendErrorEmail,
} from '@/helpers/generate-error-email'
import logger from '@/helpers/logger'
import tracer from '@/helpers/tracer'
import Execution from '@/models/execution'
import ExecutionStep from '@/models/execution-step'
import Flow from '@/models/flow'
import Step from '@/models/step'
import {
  actionQueuesByName,
  enqueueActionJob,
  makeActionJobId,
} from '@/queues/action'
import { processAction } from '@/services/action'
import {
  ProcessedJobData,
  processJobAfterBatchFunction,
  processJobDataForBatchFunction,
} from '@/services/batch-action'

import processForEachStatus from './for-each-status-manager'

function convertParamsToBullMqOptions(
  params: MakeActionWorkerParams,
) /* inferred type */ {
  const { appKey, queueName, redisConnectionPrefix, queueConfig } = params
  const { isQueueDelayable, queueRateLimit } = queueConfig

  const concurrency =
    WORKER_CONCURRENCY[appKey as keyof typeof WORKER_CONCURRENCY] ||
    appConfig.workerActionConcurrency

  const workerOptions: WorkerProOptions = {
    connection: createRedisClient(),
    concurrency,
    settings: {
      backoffStrategy: exponentialBackoffWithJitter,
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

export interface JobProgressData {
  $: IGlobalVariable // all functions will be dropped
  forEachContext: ForEachContext
  metadata: NextStepMetadata
  step: Step
  nextStep: Step
  batchJobTimestamp: string
}

export interface JobProgress {
  error?: Error
  // the remaining data to be processed
  jobProgressData: Partial<JobProgressData>
}

// This is to extract the app_action key from the group id
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
      async (job) => {
        const span = tracer.scope().active()

        const jobData = job.data
        const jobId = makeActionJobId(queueName, job.id)

        // early termination if the job was processed by the batch function
        if (job.progress !== 0 && JSON.stringify(job.progress) !== '{}') {
          // Either it is an unrecoverable error before the batch function is called
          const jobProgress: JobProgress = job.progress as JobProgress
          if (jobProgress.error) {
            throw jobProgress.error
          } else {
            // It was processed by the batch function, either it succeeded or failed
            await processJobAfterBatchFunction(
              job,
              jobProgress.jobProgressData as JobProgressData,
              worker,
              {
                queueName,
                workerOptions,
                isQueueDelayable,
              },
            )
          }
          return
        }

        // Check whether to do batching on the job, else just process the job normally
        /**
         * Check whether to do batching on the job
         * 1. If a group exists in the queue
         * 2. If the group id has a batch function attached to it
         */
        const queue = actionQueuesByName[queueName]
        const groupId = job.opts?.group?.id ?? ''
        const appActionKey = splitOnLastDelimiter(groupId, '_')
        if (appActionKey in BATCH_RUN_FUNCTIONS) {
          const batchRunFunction = BATCH_RUN_FUNCTIONS[appActionKey]
          // TODO: check but im sure they are returning me in the newest to older order of insertion so need to reverse because workers still process FIFO unless priority is set
          const jobsInGroup = (await queue.getGroupJobs(groupId, 0, 10)) // number of jobs to batch
            .reverse()

          const batchJobTimestamp = new Date(job.timestamp).toISOString()
          const jobsToProcessData: ProcessedJobData[] = []
          // pre-process current job first, throw unrecoverable error if error.
          await processJobDataForBatchFunction(
            job,
            jobsToProcessData,
            batchJobTimestamp,
          )
          // early termination if there is an error
          const jobProgress: JobProgress = job.progress as JobProgress
          if (jobProgress.error) {
            throw jobProgress.error
          }

          for (const job of jobsInGroup) {
            // pre-process job for the details, set unrecoverable error to progress
            await processJobDataForBatchFunction(
              job,
              jobsToProcessData,
              batchJobTimestamp,
            )
          }

          // pass it into the batch run function, if error on the batch function, throw the error immediately... skip processing the rest...
          // TODO: decide whether to throw the error immediately or not...
          await batchRunFunction(jobsToProcessData)

          // do not insert execution step and enqueue next job yet for the remaining jobs, only do it when the job gets processed respectively: to ensure the jobs get queued in the correct order based on the steps in the flow

          // process current job in the group
          await processJobAfterBatchFunction(
            job,
            jobProgress.jobProgressData as JobProgressData,
            worker,
            { queueName, workerOptions, isQueueDelayable },
          )
          return
        }

        // The reason why we dont add .throwIfNotFound() here is to prevent job
        // retries delegating the error throwing and handling to processAction
        // where it also queries for Step.
        const currStep = await Step.query().findById(jobData.stepId)

        span?.addTags({
          queueName,
          flowId: jobData.flowId,
          executionId: jobData.executionId,
          stepId: jobData.stepId,
          actionKey: currStep?.key,
          appKey: currStep?.appKey,
          jobId,
          jobEnqueueTime: job.timestamp,
          jobDelay: job.opts?.delay ?? 0,
          attempts: job.attemptsStarted,
          timeInJobQueue: Date.now() - job.timestamp - (job.opts?.delay ?? 0),
          workerVersion: appConfig.version,
        })

        const {
          flowId,
          executionId,
          nextStep,
          executionStep,
          nextStepMetadata,
          executionError,
        } = await processAction({ ...jobData, jobId }).catch(async (err) => {
          // This happens when the prerequisite steps for the action fails (e.g.
          // db error, missing execution, flow, step, etc...) in such cases, we
          // do not want to retry
          throw new UnrecoverableError(
            err.message || 'Action failed to execute',
          )
        })

        if (executionStep.isFailed) {
          if (nextStepMetadata?.iteration) {
            await ExecutionStep.patchIterationStatus(
              executionId,
              nextStepMetadata.iteration,
              'failure',
            )
          }
          return handleFailedStepAndThrow({
            errorDetails: executionStep.errorDetails,
            executionError,
            context: {
              isQueueDelayable,
              worker,
              span,
              job,
            },
          })
        }

        if (!nextStep) {
          const shouldContinue = await processForEachStatus({
            executionId,
            currStep,
            nextStepMetadata,
          })

          if (!shouldContinue) {
            return
          }

          await Execution.setStatus(executionId, 'success')
          return
        }

        const jobName = `${executionId}-${nextStep.id}`

        const jobPayload = {
          flowId,
          executionId,
          stepId: nextStep.id,
          metadata: nextStepMetadata,
        }

        let jobOptions = DEFAULT_JOB_OPTIONS

        if (currStep.appKey === 'delay') {
          jobOptions = {
            ...DEFAULT_JOB_OPTIONS,
            delay: delayAsMilliseconds(currStep.key, executionStep.dataOut),
          }
        }

        try {
          await enqueueActionJob({
            appKey: nextStep.appKey,
            jobName,
            jobData: jobPayload,
            jobOptions,
          })
        } catch (error) {
          // Don't retry if we failed to enqueue the next step (e.g. if
          // getGroupConfigForJob throws an error)
          throw new UnrecoverableError(error.message)
        }
      },
    ),
    workerOptions,
  )

  worker.on('active', (job) => {
    logger.info(
      `[${queueName}] JOB ID: ${job.id} - FLOW ID: ${job.data.flowId} has started!`,
      {
        queueName,
        job: job.data,
        workerVersion: appConfig.version,
      },
    )
  })

  worker.on('completed', (job) => {
    logger.info(
      `[${queueName}] JOB ID: ${job.id} - FLOW ID: ${job.data.flowId} has completed!`,
      {
        queueName,
        job: job.data,
        workerVersion: appConfig.version,
      },
    )
  })

  worker.on('failed', async (job, err) => {
    const { flowId, executionId } = job.data

    logger.error(
      `[${queueName}] JOB ID: ${job.id} - FLOW ID: ${flowId} has failed to start with ${err.message}`,
      {
        err,
        queueName,
        job: job.data,
        attemptsMade: job.attemptsMade,
        attemptsStarted: job.attemptsStarted,
        workerVersion: appConfig.version,
      },
    )

    // The job will be retried if:
    // 1. The error is not an UnrecoverableError, and
    // 2. We haven't exceeded the maximum number of retry attempts
    const willRetryJob =
      !(err instanceof UnrecoverableError) && // Not an unrecoverable error
      job.attemptsMade < MAXIMUM_JOB_ATTEMPTS // Haven't reached max attempts

    // No further post-processing needed if we're retrying.
    if (willRetryJob) {
      return
    }

    try {
      await Execution.setStatus(executionId, 'failure')

      const flow = await Flow.query()
        .findById(job.data.flowId)
        .withGraphFetched('user')
        .throwIfNotFound()

      const shouldAlwaysSendEmail =
        flow.config?.errorConfig?.notificationFrequency === 'always'

      // Don't check redis if notification frequency is always
      if (!shouldAlwaysSendEmail && (await isErrorEmailAlreadySent(flowId))) {
        return
      }

      const emailErrorDetails = await sendErrorEmail(flow)
      logger.info(`Sent error email for execution ID: ${executionId}`, {
        errorDetails: { ...emailErrorDetails, ...job.data },
      })
    } catch (err) {
      logger.error(
        `Error while running onFailed callback for execution ID ${executionId}`,
        {
          event: 'onfailed-callback-failed',
          err,
          jobData: job.data,
        },
      )
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
