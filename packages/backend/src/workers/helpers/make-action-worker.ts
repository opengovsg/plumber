import type { IActionJobData, IAppQueue } from '@plumber/types'

import {
  UnrecoverableError,
  WorkerPro,
  type WorkerProOptions,
} from '@taskforcesh/bullmq-pro'

import appConfig from '@/config/app'
import { createRedisClient } from '@/config/redis'
import { handleFailedStepAndThrow } from '@/helpers/actions'
import { exponentialBackoffWithJitter } from '@/helpers/backoff'
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
import Flow from '@/models/flow'
import Step from '@/models/step'
import { enqueueActionJob, makeActionJobId } from '@/queues/action'
import { processAction } from '@/services/action'

function convertParamsToBullMqOptions(
  params: MakeActionWorkerParams,
) /* inferred type */ {
  const { queueName, redisConnectionPrefix, queueConfig } = params
  const { isQueueDelayable, queueRateLimit } = queueConfig

  const workerOptions: WorkerProOptions = {
    connection: createRedisClient(),
    concurrency: appConfig.workerActionConcurrency,
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
  queueName: string
  redisConnectionPrefix?: string
  queueConfig: IAppQueue
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
          jobCreationTime: job.timestamp,
          timeInJobQueue: Date.now() - job.timestamp,
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

    const willRetryJob = !(
      err instanceof UnrecoverableError ||
      job.attemptsMade === MAXIMUM_JOB_ATTEMPTS
    )
    if (willRetryJob) {
      // No further post-processing needed if we're retrying.
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

  process.on('SIGTERM', async () => {
    await worker.close()
  })

  return worker
}
