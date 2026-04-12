import type { IActionJobData, IAppQueue } from '@plumber/types'

import appConfig from '@/config/app'
import { createRedisClient } from '@/config/redis'
import { WORKER_CONCURRENCY } from '@/config/workers'
import { handleFailedStepAndThrow } from '@/helpers/actions'
import { exponentialBackoffWithJitter } from '@/helpers/backoff'
import { DEFAULT_JOB_OPTIONS } from '@/helpers/default-job-configuration'
import delayAsMilliseconds from '@/helpers/delay-as-milliseconds'
import tracer from '@/helpers/tracer'
import {
  UnrecoverableError,
  WorkerPro,
  type WorkerProOptions,
} from '@/lib/bullmq-pro-compat'
import Execution from '@/models/execution'
import ExecutionStep from '@/models/execution-step'
import Step from '@/models/step'
import { enqueueActionJob, makeActionJobId } from '@/queues/action'
import { processAction } from '@/services/action'

import processForEachStatus from './for-each-status-manager'
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

  registerWorkerEventHandlers(worker, queueName)

  return worker
}
