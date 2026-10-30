import type { Redis } from 'ioredis'

import logger from '@/helpers/logger'

import type { ReconcilerCheck } from '../run-checks'
import type { ActionQueue } from './action-queues'

// BullMQ scores a delayed job as its due time in millis times 0x1000, plus a sequence number below 0x1000.
const DELAYED_SCORE_MULTIPLIER = 0x1000

interface CreateDelayedJobsCheckInput {
  jobsRedis: Pick<Redis, 'zcount'>
  queues: ActionQueue[]
  thresholdSeconds: number
}

export function createDelayedJobsCheck({
  jobsRedis,
  queues,
  thresholdSeconds,
}: CreateDelayedJobsCheckInput): ReconcilerCheck {
  return {
    name: 'delayed-jobs',
    run: async () => {
      const latestPastDueMillis = Date.now() - thresholdSeconds * 1000
      const exclusiveMaxScore = `(${
        latestPastDueMillis * DELAYED_SCORE_MULTIPLIER
      }`

      const pastDueCounts = await Promise.all(
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
          pastDueCount: pastDueCounts[index],
        }
        if (pastDueCounts[index] > 0) {
          logger.warn('Delayed jobs check found past-due jobs', logDetails)
        } else {
          logger.info('Delayed jobs check found no past-due jobs', logDetails)
        }
      })
    },
  }
}
