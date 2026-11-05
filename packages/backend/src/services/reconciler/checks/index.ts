import type { Redis } from 'ioredis'

import type { ReconcilerCheck } from '../run-checks'
import { createSchedulerPipesCheck } from './scheduler-pipes'
import { parseSchedulerPipesCheckConfig } from './scheduler-pipes/config'

interface CreateReconcilerChecksInput {
  jobsRedis: Pick<Redis, 'zrange'>
}

export function createReconcilerChecks({
  jobsRedis,
}: CreateReconcilerChecksInput): ReconcilerCheck[] {
  return [
    createSchedulerPipesCheck({
      jobsRedis,
      config: parseSchedulerPipesCheckConfig(process.env),
    }),
  ]
}
