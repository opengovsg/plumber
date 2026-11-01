import type { Redis } from 'ioredis'

import { DELAY_STEP_GRACE_SECONDS } from '@/config/workers'

import type { ReconcilerCheck } from '../run-checks'
import { createDelayedJobsCheck } from './delayed-jobs'
import { ACTION_QUEUES } from './delayed-jobs/action-queues'
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
      graceSeconds: DELAY_STEP_GRACE_SECONDS,
    }),
  ]
}
