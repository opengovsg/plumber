import { Worker } from 'bullmq'

import redisConfig from '../config/redis'
import { DEFAULT_JOB_OPTIONS } from '../helpers/default-job-configuration'
import delayAsMilliseconds from '../helpers/delay-as-milliseconds'
import logger from '../helpers/logger'
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
    const { stepId, flowId, executionId, proceedToNextAction, executionStep } =
      await processAction(job.data as JobData)

    if (executionStep.isFailed) {
      throw new Error(JSON.stringify(executionStep.errorDetails))
    }

    const step = await Step.query().findById(stepId).throwIfNotFound()
    const nextStep = await step.getNextStep()

    if (!nextStep || !proceedToNextAction) {
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
  },
  { connection: redisConfig },
)

worker.on('completed', (job) => {
  logger.info(`JOB ID: ${job.id} - FLOW ID: ${job.data.flowId} has started!`)
})

worker.on('failed', (job, err) => {
  logger.info(
    `JOB ID: ${job.id} - FLOW ID: ${job.data.flowId} has failed to start with ${err.message}`,
  )
})

process.on('SIGTERM', async () => {
  await worker.close()
})
