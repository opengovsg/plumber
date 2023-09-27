import { Worker } from 'bullmq'

import appConfig from '@/config/app'
import { createRedisClient } from '@/config/redis'
import { DEFAULT_JOB_OPTIONS } from '@/helpers/default-job-configuration'
import delayAsMilliseconds from '@/helpers/delay-as-milliseconds'
import logger from '@/helpers/logger'
import tracer from '@/helpers/tracer'
import Step from '@/models/step'
import actionQueue from '@/queues/action'
import { processAction } from '@/services/action'

type JobData = {
  flowId: string
  executionId: string
  stepId: string
}

export const worker = new Worker(
  'action',
  tracer.wrap('workers.action', async (job) => {
    const { stepId, flowId, executionId, nextStep, executionStep } =
      await processAction({ ...(job.data as JobData), jobId: job.id })

    if (executionStep.isFailed) {
      throw new Error(JSON.stringify(executionStep.errorDetails))
    }

    const step = await Step.query().findById(stepId).throwIfNotFound()

    // dd-trace span tagging
    const span = tracer.scope().active()
    span?.addTags({
      flowId,
      executionId,
      stepId,
      appKey: step.appKey,
    })

    if (!nextStep) {
      return
    }

    const jobName = `${executionId}-${nextStep.id}`

    const jobPayload = {
      flowId,
      executionId,
      stepId: nextStep.id,
    }

    let jobOptions = DEFAULT_JOB_OPTIONS

    if (step.appKey === 'delay') {
      jobOptions = {
        ...DEFAULT_JOB_OPTIONS,
        delay: delayAsMilliseconds(step.key, executionStep.dataIn),
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

worker.on('failed', (job, err) => {
  logger.error(
    `JOB ID: ${job.id} - FLOW ID: ${job.data.flowId} has failed to start with ${err.message}`,
    {
      err,
      job: job.data,
    },
  )
})

process.on('SIGTERM', async () => {
  await worker.close()
})
