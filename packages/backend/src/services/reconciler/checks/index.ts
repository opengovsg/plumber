import type { Redis } from 'ioredis'

import type { ReconcilerCheck } from '../run-checks'
import { createSchedulerPipesCheck } from './scheduler-pipes'
import { parseSchedulerPipesCheckConfig } from './scheduler-pipes/config'

interface CreateReconcilerChecksInput {
  jobsRedis: Pick<Redis, 'zrange' | 'hmget'>
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
  ]
}
