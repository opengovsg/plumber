import { NextStepMetadata } from '@plumber/types'

import { UnrecoverableError, Worker } from 'bullmq'

import appConfig from '@/config/app'
import { createRedisClient } from '@/config/redis'
import { handleErrorAndThrow } from '@/helpers/actions'
import { exponentialBackoffWithJitterStrategy } from '@/helpers/backoff'
import {
  DEFAULT_JOB_OPTIONS,
  MAXIMUM_JOB_ATTEMPTS,
} from '@/helpers/default-job-configuration'
import { checkErrorEmail, sendErrorEmail } from '@/helpers/generate-error-email'
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

export const worker = new Worker(
  'action',
  tracer.wrap('workers.action', async (job) => {
    const jobData = job.data as JobData

    // the reason why we dont add .throwIfNotFound() here is to prevent job retries
    // delegating the error throwing and handling to processAction where it also queries for Step
    const step: Step = await Step.query().findById(jobData.stepId)

    const span = tracer.scope().active()
    span?.addTags({
      flowId: jobData.flowId,
      executionId: jobData.executionId,
      stepId: jobData.stepId,
      actionKey: step?.key,
      appKey: step?.appKey,
    })

    const {
      flowId,
      executionInfo: { execution, executionStep, error: executionError },
      nextStepInfo,
    } = await processAction({
      ...jobData,
      jobId: job.id,
    }).catch(async (err) => {
      // this happens when the prerequisite steps for the action fails (e.g. db error, missing execution, flow, step, etc...)
      // in such cases, we do not want to retry
      await Execution.setStatus(jobData.executionId, 'failure')
      throw new UnrecoverableError(err.message || 'Action failed to execute')
    })

    if (executionStep.isFailed) {
      await Execution.setStatus(executionStep.id, 'failure')
      return handleErrorAndThrow(executionStep.errorDetails, executionError)
    }

    if (!nextStepInfo) {
      await Execution.setStatus(executionStep.id, 'success')
      return
    }

    const jobName = `${executionStep.id}-${nextStepInfo.step.id}`

    const jobPayload = {
      flowId,
      executionId: execution.id,
      stepId: nextStepInfo.step.id,
      metadata: nextStepInfo.metadata,
    }

    const jobOptions = {
      ...DEFAULT_JOB_OPTIONS,
      ...(nextStepInfo.delayMs ? { delay: nextStepInfo.delayMs } : {}),
    }

    await actionQueue.add(jobName, jobPayload, jobOptions)
  }),
  {
    prefix: '{actionQ}',
    connection: createRedisClient(),
    concurrency: appConfig.workerActionConcurrency,
    settings: {
      backoffStrategy: exponentialBackoffWithJitterStrategy,
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
  const isEmailSent = await checkErrorEmail(job.data.flowId)
  if (isEmailSent) {
    return
  }
  if (
    err instanceof UnrecoverableError ||
    job.attemptsMade === MAXIMUM_JOB_ATTEMPTS
  ) {
    const flow = await Flow.query()
      .findById(job.data.flowId)
      .withGraphFetched('user')
      .throwIfNotFound()
    const emailErrorDetails = await sendErrorEmail(flow)
    logger.info(`Sent error email for FLOW ID: ${job.data.flowId}`, {
      errorDetails: { ...emailErrorDetails, ...job.data },
    })
  }
})

process.on('SIGTERM', async () => {
  await worker.close()
})
