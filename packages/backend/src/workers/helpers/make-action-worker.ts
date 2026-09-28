import type { IActionJobData, IAppQueue } from '@plumber/types'

import {
  UnrecoverableError,
  WorkerPro,
  type WorkerProOptions,
} from '@taskforcesh/bullmq-pro'

import appConfig from '@/config/app'
import { createRedisClient } from '@/config/redis'
import { WORKER_CONCURRENCY } from '@/config/workers'
import FileLockContentionError from '@/errors/file-lock-contention'
import { exponentialBackoffWithJitter } from '@/helpers/backoff'
import tracer from '@/helpers/tracer'
import Step from '@/models/step'
import { makeActionJobId } from '@/queues/action'
import { processAction } from '@/services/action'

import { advanceAfterStep } from './advance-after-step'
import { getJobQueueTimingTags } from './job-queue-timing'
import { requeueOnFileLockContention } from './requeue-on-file-lock-contention'
import { registerWorkerEventHandlers } from './worker-event-handlers'

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
          ...getJobQueueTimingTags(job),
          workerVersion: appConfig.version,
        })

        const processResult = await processAction({ ...jobData, jobId }).catch(
          async (err) => {
            // Lost the per-file lock race (see file-lock.ts). Re-queue onto the
            // group with a short delay WITHOUT consuming an attempt - no failed
            // step was recorded, so this contention stays invisible.
            if (err instanceof FileLockContentionError) {
              return requeueOnFileLockContention(worker, job)
            }
            // This happens when the prerequisite steps for the action fails
            // (e.g. db error, missing execution, flow, step, etc...) in such
            // cases, we do not want to retry
            throw new UnrecoverableError(
              err.message || 'Action failed to execute',
            )
          },
        )

        await advanceAfterStep({
          processResult,
          currStep,
          context: {
            isQueueDelayable,
            span,
            worker,
            job,
          },
        })
      },
    ),
    workerOptions,
  )

  registerWorkerEventHandlers(worker, queueName)

  return worker
}
