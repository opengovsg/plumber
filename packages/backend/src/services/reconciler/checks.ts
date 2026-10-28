import type { Redis } from 'ioredis'

import { OVERDUE_DELAY_STEP_THRESHOLD_SECONDS } from '@/config/workers'

import { createDelayedJobsCheck } from './delayed-jobs-check'
import { ACTION_QUEUES } from './delayed-jobs-check/action-queues'
import type { ReconcilerCheck } from './run-checks'
import { createScheduleCheck } from './schedule-check'
import { parseScheduleCheckConfig } from './schedule-check/config'

interface CreateReconcilerChecksInput {
  jobsRedis: Pick<Redis, 'zrange' | 'hmget' | 'zcount'>
  markerRedis: Pick<Redis, 'set'>
}

export function createReconcilerChecks({
  jobsRedis,
  markerRedis,
}: CreateReconcilerChecksInput): ReconcilerCheck[] {
  return [
    createScheduleCheck({
      jobsRedis,
      markerRedis,
      config: parseScheduleCheckConfig(process.env),
    }),
    createDelayedJobsCheck({
      jobsRedis,
      queues: ACTION_QUEUES,
      thresholdSeconds: OVERDUE_DELAY_STEP_THRESHOLD_SECONDS,
    }),
  ]
}
