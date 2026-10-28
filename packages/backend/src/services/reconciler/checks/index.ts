import type { Redis } from 'ioredis'

import { OVERDUE_DELAY_STEP_THRESHOLD_SECONDS } from '@/config/workers'

import { createDelayedJobsCheck } from '../delayed-jobs-check'
import { ACTION_QUEUES } from '../delayed-jobs-check/action-queues'
import type { ReconcilerCheck } from '../run-checks'
import { createSchedulerPipesCheck } from './scheduler-pipes'
import { parseSchedulerPipesCheckConfig } from './scheduler-pipes/config'

interface CreateReconcilerChecksInput {
  jobsRedis: Pick<Redis, 'zrange' | 'hmget' | 'zcount'>
  markerRedis: Pick<Redis, 'pipeline'>
}

export function createReconcilerChecks({
  jobsRedis,
  markerRedis,
}: CreateReconcilerChecksInput): ReconcilerCheck[] {
  return [
    createSchedulerPipesCheck({
      jobsRedis,
      markerRedis,
      config: parseSchedulerPipesCheckConfig(process.env),
    }),
    createDelayedJobsCheck({
      jobsRedis,
      queues: ACTION_QUEUES,
      thresholdSeconds: OVERDUE_DELAY_STEP_THRESHOLD_SECONDS,
    }),
  ]
}
