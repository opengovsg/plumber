import type { Redis } from 'ioredis'

import logger from '@/helpers/logger'

import type { ReconcilerCheck } from '../../run-checks'
import type { ActionQueue } from './action-queues'

// BullMQ scores a delayed job as its due time in millis times 0x1000, plus a sequence number below 0x1000.
const DELAYED_SCORE_MULTIPLIER = 0x1000

interface CreateDelayedJobsCheckInput {
  jobsRedis: Pick<Redis, 'zcount'>
  queues: ActionQueue[]
  graceSeconds: number
}

export function createDelayedJobsCheck({
  jobsRedis,
  queues,
  graceSeconds,
}: CreateDelayedJobsCheckInput): ReconcilerCheck {
  return {
    name: 'delayed-jobs',
    run: async () => {
      const overdueBeforeMillis = Date.now() - graceSeconds * 1000
      const exclusiveMaxScore = `(${
        overdueBeforeMillis * DELAYED_SCORE_MULTIPLIER
      }`

      const overdueCounts = await Promise.all(
        queues.map(({ prefix, name }) =>
          jobsRedis.zcount(
            `${prefix}:${name}:delayed`,
            '-inf',
            exclusiveMaxScore,
          ),
        ),
      )

      queues.forEach(({ name }, index) => {
        const logDetails = {
          event: 'reconciler-delayed-jobs-check',
          queue: name,
          overdueCount: overdueCounts[index],
        }
        if (overdueCounts[index] > 0) {
          logger.warn('Delayed jobs check found overdue jobs', logDetails)
        } else {
          logger.info('Delayed jobs check found no overdue jobs', logDetails)
        }
      })
    },
  }
}
