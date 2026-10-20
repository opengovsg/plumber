import type { Redis } from 'ioredis'

import type { ReconcilerCheck } from './run-loop'
import { createScheduleCheck } from './schedule-check'
import { parseScheduleCheckConfig } from './schedule-check/config'

interface CreateReconcilerChecksInput {
  jobsRedis: Pick<Redis, 'zrange'>
}

export function createReconcilerChecks({
  jobsRedis,
}: CreateReconcilerChecksInput): ReconcilerCheck[] {
  return [
    createScheduleCheck({
      jobsRedis,
      config: parseScheduleCheckConfig(process.env),
    }),
  ]
}
