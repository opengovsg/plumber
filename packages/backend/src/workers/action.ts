import { NextStepMetadata } from '@plumber/types'

import { UnrecoverableError, Worker } from 'bullmq'

import appConfig from '@/config/app'
import { createRedisClient } from '@/config/redis'
import { handleErrorAndThrow } from '@/helpers/actions'
import {
  DEFAULT_JOB_OPTIONS,
  MAXIMUM_JOB_ATTEMPTS,
} from '@/helpers/default-job-configuration'
import delayAsMilliseconds from '@/helpers/delay-as-milliseconds'
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

    const step = await Step.query().findById(jobData.stepId)

    const span = tracer.scope().active()
    span?.addTags({
      flowId: jobData.flowId,
      executionId: jobData.executionId,
      stepId: jobData.stepId,
      actionKey: step?.key,
      appKey: step?.appKey,
    })

    const { flowId, executionId, nextStep, executionStep, nextStepMetadata } =
      await processAction({ ...jobData, jobId: job.id }).catch(async (err) => {
        // this happens when the prerequisite steps for the action fails (e.g. db error, missing execution, flow, step, etc...)
        // in such cases, we do not want to retry
        await Execution.setStatus(jobData.executionId, 'failure')
        throw new UnrecoverableError(err.message || 'Action failed to execute')
      })

    if (executionStep.isFailed) {
      await Execution.setStatus(executionId, 'failure')
      return handleErrorAndThrow(executionStep.errorDetails)
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
  }),
  {
    prefix: '{actionQ}',
    connection: createRedisClient(),
    concurrency: appConfig.workerActionConcurrency,
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
    const errorDetails = await sendErrorEmail(flow)
    logger.info(`Sent error email for FLOW ID: ${job.data.flowId}`, {
      errorDetails,
    })
  }
})

process.on('SIGTERM', async () => {
  await worker.close()
})
