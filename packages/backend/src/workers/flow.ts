import { WorkerPro } from '@taskforcesh/bullmq-pro'

import { createRedisClient } from '@/config/redis'
import {
  REMOVE_AFTER_7_DAYS_OR_50_JOBS,
  REMOVE_AFTER_30_DAYS,
} from '@/helpers/default-job-configuration'
import logger from '@/helpers/logger'
import tracer from '@/helpers/tracer'
import Flow from '@/models/flow'
import triggerQueue from '@/queues/trigger'
import { processFlow } from '@/services/flow'

export const worker = new WorkerPro(
  'flow',
  tracer.wrap('workers.flow', async (job) => {
    const span = tracer.scope().active()
    const { flowId } = job.data

    // Tagged before the flow lookup so runs that fail still count towards the lateness SLO.
    if (job.opts.prevMillis !== undefined) {
      span?.setTag('schedule.lateness_ms', Date.now() - job.opts.prevMillis)
    }

    const flow = await Flow.query().findById(flowId).throwIfNotFound()

    // Inactive runs come from failed unpublish cleanup, not user schedules.
    span?.setTag('flow.active', flow.active)

    // safe guard to prevent processing unpublished flows with scheduler
    if (!flow.active) {
      logger.warn({
        message: 'Flow is not active but scheduled',
        flowId,
        jobId: job.id,
      })
      return
    }

    const triggerStep = await flow.getTriggerStep()

    const { data, error } = await processFlow({ flowId })

    const reversedData = data.reverse()

    const jobOptions = {
      removeOnComplete: REMOVE_AFTER_7_DAYS_OR_50_JOBS,
      removeOnFail: REMOVE_AFTER_30_DAYS,
    }

    for (const triggerItem of reversedData) {
      const jobName = `${triggerStep.id}-${triggerItem.meta.internalId}`

      const jobPayload = {
        flowId,
        stepId: triggerStep.id,
        triggerItem,
      }

      await triggerQueue.add(jobName, jobPayload, jobOptions)
    }

    if (error) {
      const jobName = `${triggerStep.id}-error`

      const jobPayload = {
        flowId,
        stepId: triggerStep.id,
        error,
      }

      await triggerQueue.add(jobName, jobPayload, jobOptions)
    }
  }),
  {
    prefix: '{flowQ}',
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

worker.on('ready', () => {
  logger.info('Flow worker is ready!')
})

worker.on('closed', () => {
  logger.info('Flow worker is closed!')
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
