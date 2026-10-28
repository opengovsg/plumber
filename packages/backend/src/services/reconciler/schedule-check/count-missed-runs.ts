import type { Redis } from 'ioredis'

import logger from '@/helpers/logger'
import { makeRedisAppDataKey } from '@/helpers/redis-app-data'

import { MISSED_RUN_MARKER_TTL_SECONDS, type MissedRun } from './missed-runs'

interface CountMissedRunsInput {
  markerRedis: Pick<Redis, 'set'>
  missedRuns: MissedRun[]
}

/**
 * Returns the missed runs that no earlier check or other task counted yet.
 */
export async function countMissedRuns({
  markerRedis,
  missedRuns,
}: CountMissedRunsInput): Promise<MissedRun[]> {
  const newlyCounted: MissedRun[] = []

  for (const missedRun of missedRuns) {
    const result = await markerRedis.set(
      makeRedisAppDataKey(
        'scheduler',
        `missed-run:${missedRun.flowId}:${missedRun.runTimeMillis}`,
      ),
      '1',
      'EX',
      MISSED_RUN_MARKER_TTL_SECONDS,
      'NX',
    )
    if (result === 'OK') {
      logger.warn('Schedule check counted a missed run', {
        event: 'reconciler-missed-run',
        flowId: missedRun.flowId,
        runTimeMillis: missedRun.runTimeMillis,
        reason: missedRun.reason,
      })
      newlyCounted.push(missedRun)
    }
  }

  return newlyCounted
}
