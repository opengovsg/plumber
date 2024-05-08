import { IJSONObject, ITriggerItem } from '@plumber/types'

import { UnrecoverableError, WorkerPro } from '@taskforcesh/bullmq-pro'

import { createRedisClient } from '@/config/redis'
import { DEFAULT_JOB_OPTIONS } from '@/helpers/default-job-configuration'
import logger from '@/helpers/logger'
import Step from '@/models/step'
import { enqueueActionJob } from '@/queues/action'
import { processTrigger } from '@/services/trigger'

type JobData = {
  flowId: string
  stepId: string
  triggerItem?: ITriggerItem
  error?: IJSONObject
}

export const worker = new WorkerPro(
  'trigger',
  async (job) => {
    const { flowId, executionId, stepId, executionStep } = await processTrigger(
      job.data as JobData,
    )

    if (executionStep.isFailed) {
      return
    }

    const step = await Step.query().findById(stepId).throwIfNotFound()
    const nextStep = await step.getNextStep()
    const jobName = `${executionId}-${nextStep.id}`

    const jobData = {
      flowId,
      executionId,
      stepId: nextStep.id,
    }

    try {
      await enqueueActionJob({
        appKey: nextStep.appKey,
        jobName,
        jobData,
        jobOptions: DEFAULT_JOB_OPTIONS,
      })
    } catch (error) {
      // Don't retry if we failed to enqueue the next step (e.g. if
      // getGroupConfigForJob throws an error)
      throw new UnrecoverableError(error.message)
    }
  },
  {
    prefix: '{triggerQ}',
    connection: createRedisClient(),
  },
)

worker.on('completed', (job) => {
  logger.info(`JOB ID: ${job.id} - FLOW ID: ${job.data.flowId} has started!`)
})

worker.on('failed', (job, err) => {
  logger.error(
    `JOB ID: ${job.id} - FLOW ID: ${job.data.flowId} has failed to start with ${err.message}`,
  )
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
