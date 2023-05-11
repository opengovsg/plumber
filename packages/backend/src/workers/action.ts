import { Worker } from 'bullmq'

import { createRedisClient } from '../config/redis'
import { DEFAULT_JOB_OPTIONS } from '../helpers/default-job-configuration'
import delayAsMilliseconds from '../helpers/delay-as-milliseconds'
import logger from '../helpers/logger'
import tracer from '../helpers/tracer'
import Step from '../models/step'
import actionQueue from '../queues/action'
import { processAction } from '../services/action'

type JobData = {
  flowId: string
  executionId: string
  stepId: string
}

export const worker = new Worker(
  'action',
  async (job) => {
    // dd-trace custom span start
    const span = tracer.startSpan('worker.action')

    const { stepId, flowId, executionId, proceedToNextAction, executionStep } =
      await processAction({ ...(job.data as JobData), jobId: job.id })

    if (executionStep.isFailed) {
      throw new Error(JSON.stringify(executionStep.errorDetails))
    }

    const step = await Step.query().findById(stepId).throwIfNotFound()
    const nextStep = await step.getNextStep()

    // dd-trace span tagging
    span.addTags({
      flowId,
      executionId,
      stepId,
      appKey: step.appKey,
    })

    if (!nextStep || !proceedToNextAction) {
      // If no more further steps, end span here
      span.finish()
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
      jobOptions = { ...DEFAULT_JOB_OPTIONS, delay: delayAsMilliseconds(step) }
    }

    await actionQueue.add(jobName, jobPayload, jobOptions)

    // end span
    span.finish()
  },
  {
    prefix: '{actionQ}',
    connection: createRedisClient(),
    concurrency: 3,
  },
)

worker.on('active', (job) => {
  logger.info(`JOB ID: ${job.id} - FLOW ID: ${job.data.flowId} has started!`)
})

worker.on('completed', (job) => {
  logger.info(`JOB ID: ${job.id} - FLOW ID: ${job.data.flowId} has completed!`)
})

worker.on('failed', (job, err) => {
  logger.info(
    `JOB ID: ${job.id} - FLOW ID: ${job.data.flowId} has failed to start with ${err.message}`,
  )
})

process.on('SIGTERM', async () => {
  await worker.close()
})
