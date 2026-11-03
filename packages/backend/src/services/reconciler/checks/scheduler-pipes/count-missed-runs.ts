import type { Redis } from 'ioredis'
import { chunk } from 'lodash'

import logger from '@/helpers/logger'
import { makeRedisAppDataKey } from '@/helpers/redis-app-data'

import {
  MISSED_RUN_MARKER_TTL_SECONDS,
  type MissedRun,
  type MissedRunReason,
} from './missed-runs'

// Every Redis key shares one primary, so a large burst would delay the job queues.
const PIPES_IN_FLIGHT = 10

// Fits a week of hourly runs and stops one huge ZADD from stalling the job queues.
const MAX_RUN_TIMES_PER_ZADD = 169

interface CountMissedRunsInput {
  markerRedis: Pick<Redis, 'pipeline'>
  missedRuns: MissedRun[]
  nowMillis: number
}

function groupRunTimesByPipeAndReason(
  missedRuns: MissedRun[],
): Map<string, Map<MissedRunReason, number[]>> {
  const runTimesByPipe = new Map<string, Map<MissedRunReason, number[]>>()
  for (const { flowId, reason, runTimeMillis } of missedRuns) {
    const runTimesByReason = runTimesByPipe.get(flowId) ?? new Map()
    runTimesByReason.set(reason, [
      ...(runTimesByReason.get(reason) ?? []),
      runTimeMillis,
    ])
    runTimesByPipe.set(flowId, runTimesByReason)
  }
  return runTimesByPipe
}

async function countPipeMissedRuns(
  markerRedis: Pick<Redis, 'pipeline'>,
  flowId: string,
  runTimesByReason: Map<MissedRunReason, number[]>,
  nowMillis: number,
): Promise<number> {
  const key = makeRedisAppDataKey('scheduler', `missed-runs:${flowId}`)
  const zadds = [...runTimesByReason].flatMap(([reason, runTimes]) =>
    chunk(runTimes, MAX_RUN_TIMES_PER_ZADD).map((runTimesChunk) => ({
      reason,
      runTimes: runTimesChunk,
    })),
  )

  // Not MULTI, so Redis can serve the job queues between ZADDs.
  // IMPORTANT: a dropped connection can leave a new key without its TTL.
  const pipeline = markerRedis.pipeline()
  for (const { runTimes } of zadds) {
    pipeline.zadd(
      key,
      'NX',
      ...runTimes.flatMap((runTime) => [runTime, String(runTime)]),
    )
  }
  // Keeps a second look-back of margin, so an overlapping task with an older clock never recounts.
  pipeline.zremrangebyscore(
    key,
    '-inf',
    `(${nowMillis - 2 * MISSED_RUN_MARKER_TTL_SECONDS * 1000}`,
  )
  pipeline.expire(key, MISSED_RUN_MARKER_TTL_SECONDS)

  const replies = await pipeline.exec()
  if (!replies) {
    throw new Error('Missed run pipeline returned no replies')
  }
  const failed = replies.find(([error]) => error)
  if (failed) {
    throw failed[0]
  }

  let newlyCountedCount = 0
  zadds.forEach(({ reason }, index) => {
    const addedCount = Number(replies[index][1])
    for (let i = 0; i < addedCount; i++) {
      logger.warn('Scheduler pipes check counted a missed run', {
        event: 'reconciler-missed-run',
        flowId,
        reason,
      })
    }
    newlyCountedCount += addedCount
  })
  return newlyCountedCount
}

/**
 * Returns how many missed runs no earlier check or other task counted yet.
 */
export async function countMissedRuns({
  markerRedis,
  missedRuns,
  nowMillis,
}: CountMissedRunsInput): Promise<number> {
  const pipes = [...groupRunTimesByPipeAndReason(missedRuns)]
  let newlyCountedCount = 0

  // Each batch is awaited, so Redis serves BullMQ's connections between batches, not after the whole loop.
  for (let start = 0; start < pipes.length; start += PIPES_IN_FLIGHT) {
    const counts = await Promise.all(
      pipes
        .slice(start, start + PIPES_IN_FLIGHT)
        .map(([flowId, runTimesByReason]) =>
          countPipeMissedRuns(markerRedis, flowId, runTimesByReason, nowMillis),
        ),
    )
    newlyCountedCount += counts.reduce((sum, count) => sum + count, 0)
  }

  return newlyCountedCount
}
