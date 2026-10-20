import type { Redis } from 'ioredis'

import type { ReconcilerCheck } from './run-loop'
import { createScheduleCheck } from './schedule-check'
import { parseScheduleCheckConfig } from './schedule-check/config'

interface CreateReconcilerChecksInput {
  jobsRedis: Pick<Redis, 'zrange' | 'hmget'>
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
  ]
}
