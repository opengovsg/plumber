import { NextStepMetadata } from '@plumber/types'

import { UnrecoverableError, WorkerPro } from '@taskforcesh/bullmq-pro'

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
import actionQueue from '@/queues/action'
import { processAction } from '@/services/action'

type JobData = {
  flowId: string
  executionId: string
  stepId: string
  metadata?: NextStepMetadata
}

export const worker = new WorkerPro(
  'action',
  tracer.wrap('workers.action', async (job) => {
    const span = tracer.scope().active()

    try {
      const jobData = job.data as JobData

      // the reason why we dont add .throwIfNotFound() here is to prevent job retries
      // delegating the error throwing and handling to processAction where it also queries for Step
      const step: Step = await Step.query().findById(jobData.stepId)

      span?.addTags({
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
        // Properly fixed in https://github.com/opengovsg/plumber/pull/548
        try {
          return handleErrorAndThrow(executionStep.errorDetails, executionError)
        } catch (e) {
          const isRetriable =
            !(e instanceof UnrecoverableError) &&
            job.attemptsMade < MAXIMUM_JOB_ATTEMPTS - 1

          logger.info('Failed execution', {
            event: 'failed-execution-job-info',
            ...jobData,
          })
          if (!isRetriable) {
            await Execution.setStatus(executionId, 'failure')
          }

          throw e
        }
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

      await actionQueue.add(jobName, jobPayload, jobOptions)
    } catch (e) {
      const isRetriable =
        !(e instanceof UnrecoverableError) &&
        job.attemptsMade < MAXIMUM_JOB_ATTEMPTS - 1

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
  }),
  {
    prefix: '{actionQ}',
    connection: createRedisClient(),
    concurrency: appConfig.workerActionConcurrency,
    settings: {
      backoffStrategy: exponentialBackoffWithJitter,
    },
  },
)

worker.on('active', (job) => {
  logger.info(`JOB ID: ${job.id} - FLOW ID: ${job.data.flowId} has started!`, {
    job: job.data,
  })
})

worker.on('completed', (job) => {
  logger.info(
    `JOB ID: ${job.id} - FLOW ID: ${job.data.flowId} has completed!`,
    {
      job: job.data,
    },
  )
})

worker.on('failed', async (job, err) => {
  logger.error(
    `JOB ID: ${job.id} - FLOW ID: ${job.data.flowId} has failed to start with ${err.message}`,
    {
      err,
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
    logger.error(`Could not send error email for FLOW ID: ${job.data.flowId}`, {
      errorDetails: { ...job.data, err: err.stack },
    })
  }
})

worker.on('error', (err) => {
  if (!err) {
    logger.error('Worker undefined error')
    return
  }
  // catch-all just in case any errors bubble up and potentially crash the worker task
  logger.error(`Worker errored with ${err.message}`, {
    err: err.stack,
  })
})

process.on('SIGTERM', async () => {
  await worker.close()
})
