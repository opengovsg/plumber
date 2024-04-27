import type { IActionJobData, IAppQueue } from '@plumber/types'

import {
  UnrecoverableError,
  WorkerPro,
  type WorkerProOptions,
} from '@taskforcesh/bullmq-pro'

import appConfig from '@/config/app'
import { createRedisClient } from '@/config/redis'
import { handleErrorAndThrow } from '@/helpers/actions'
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
import { enqueueActionJob } from '@/queues/action'
import { processAction } from '@/services/action'

import { getActionQueueDetails } from './get-action-queue-details'

function convertParamsToBullMqOptions(
  params?: MakeActionWorkerParams,
) /* inferred type */ {
  const { appKey, config } = params ?? {}
  const { queueName, redisConnectionPrefix } = getActionQueueDetails(appKey)

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

  let groupSettings: WorkerProOptions['group'] | null = null
  if (config?.groupLimits) {
    const { groupLimits } = config

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
  }
}

interface MakeActionWorkerParams {
  appKey: string
  config: IAppQueue
}

/**
 * Creates a app-specific action worker.
 *
 * To manage complexity, we enforce that all action workers use the same worker
 * processor (i.e. callback) - hence this function.
 */
export function makeActionWorker(
  params?: MakeActionWorkerParams,
): WorkerPro<IActionJobData> {
  const { queueName, workerOptions } = convertParamsToBullMqOptions(params)
  const worker = new WorkerPro<IActionJobData>(
    queueName,
    tracer.wrap(
      // Fix trace service name to workers.action regardless of queue name, so
      // that we can more easily monitor all actions.
      'workers.action',
      async (job) => {
        const span = tracer.scope().active()

        try {
          const jobData = job.data

          // the reason why we dont add .throwIfNotFound() here is to prevent job retries
          // delegating the error throwing and handling to processAction where it also queries for Step
          const step: Step = await Step.query().findById(jobData.stepId)

          span?.addTags({
            queueName,
            flowId: jobData.flowId,
            executionId: jobData.executionId,
            stepId: jobData.stepId,
            actionKey: step?.key,
            appKey: step?.appKey,
          })

          const {
            flowId,
            executionId,
            nextStep,
            executionStep,
            nextStepMetadata,
            executionError,
          } = await processAction({ ...jobData, jobId: job.id }).catch(
            async (err) => {
              // this happens when the prerequisite steps for the action fails (e.g. db error, missing execution, flow, step, etc...)
              // in such cases, we do not want to retry
              await Execution.setStatus(jobData.executionId, 'failure')
              throw new UnrecoverableError(
                err.message || 'Action failed to execute',
              )
            },
          )

          if (executionStep.isFailed) {
            await Execution.setStatus(executionId, 'failure')
            return handleErrorAndThrow(
              executionStep.errorDetails,
              executionError,
            )
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

          if (step.appKey === 'delay') {
            jobOptions = {
              ...DEFAULT_JOB_OPTIONS,
              delay: delayAsMilliseconds(step.key, executionStep.dataOut),
            }
          }

          await enqueueActionJob({
            appKey: step.appKey,
            jobName,
            jobData: jobPayload,
            jobOptions,
          })
        } catch (e) {
          const isRetriable =
            !(e instanceof UnrecoverableError) &&
            job.attemptsMade < MAXIMUM_JOB_ATTEMPTS

          span?.addTags({
            willRetry: isRetriable ? 'true' : 'false',
          })
          if (isRetriable) {
            logger.info(`Will retry flow: ${job.data.flowId}`, {
              job: job.data,
              error: e,
              attempt: job.attemptsMade + 1,
            })
          }
          throw e
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
      },
    )
  })

  worker.on('completed', (job) => {
    logger.info(
      `[${queueName}] JOB ID: ${job.id} - FLOW ID: ${job.data.flowId} has completed!`,
      {
        queueName,
        job: job.data,
      },
    )
  })

  worker.on('failed', async (job, err) => {
    logger.error(
      `[${queueName}] JOB ID: ${job.id} - FLOW ID: ${job.data.flowId} has failed to start with ${err.message}`,
      {
        err,
        queueName,
        job: job.data,
      },
    )
    try {
      const flow = await Flow.query()
        .findById(job.data.flowId)
        .withGraphFetched('user')
        .throwIfNotFound()

      const shouldAlwaysSendEmail =
        flow.config?.errorConfig?.notificationFrequency === 'always'

      // don't check redis if notification frequency is always
      if (
        !shouldAlwaysSendEmail &&
        (await isErrorEmailAlreadySent(job.data.flowId))
      ) {
        return
      }

      if (
        err instanceof UnrecoverableError ||
        job.attemptsMade === MAXIMUM_JOB_ATTEMPTS
      ) {
        const emailErrorDetails = await sendErrorEmail(flow)
        logger.info(`Sent error email for FLOW ID: ${job.data.flowId}`, {
          errorDetails: { ...emailErrorDetails, ...job.data },
        })
      }
    } catch (err) {
      logger.error(
        `Could not send error email for FLOW ID: ${job.data.flowId}`,
        {
          errorDetails: { ...job.data, err: err.stack },
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
