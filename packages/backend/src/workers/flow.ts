import { WorkerPro } from '@taskforcesh/bullmq-pro'

import { createRedisClient } from '@/config/redis'
import {
  REMOVE_AFTER_7_DAYS_OR_50_JOBS,
  REMOVE_AFTER_30_DAYS,
} from '@/helpers/default-job-configuration'
import logger from '@/helpers/logger'
import Flow from '@/models/flow'
import flowQueue from '@/queues/flow'
import triggerQueue from '@/queues/trigger'
import { processFlow } from '@/services/flow'

import {
  acquireCoordinationLock,
  calculateDelays,
  moveJobToTriggerQueue,
} from './helpers/buffer-scheduled-jobs'

export const worker = new WorkerPro(
  'flow',
  async (job) => {
    const { flowId } = job.data

    const flow = await Flow.query().findById(flowId).throwIfNotFound()
    const isRepeatingJob = job.opts.repeat

    if (isRepeatingJob) {
      // only need to buffer jobs if there are other jobs scheduled to run at the same time
      const currentJobTimestamp = job.id.split(':').pop()
      const gotLock = await acquireCoordinationLock(currentJobTimestamp)
      if (gotLock) {
        const repeatableJobs = await flowQueue.getRepeatableJobs()

        // only get jobs that are meant to execute at the same time
        // do not include the current job as it will automatically be handled by the worker
        const jobsWithSameTimestamp = repeatableJobs.filter(
          (r) => r.next === Number(currentJobTimestamp) && r.id !== flowId,
        )

        if (jobsWithSameTimestamp.length > 0) {
          const delays = calculateDelays(
            jobsWithSameTimestamp.length + 1,
          ).slice(1)

          for (let i = 0; i < jobsWithSameTimestamp.length; i++) {
            const job = jobsWithSameTimestamp[i]
            await moveJobToTriggerQueue(job.id, delays[i])
          }
        }
      } else {
        // do nothing when there is no lock, the repeatable job has already been added to the trigger queue
        return
      }
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
  },
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
