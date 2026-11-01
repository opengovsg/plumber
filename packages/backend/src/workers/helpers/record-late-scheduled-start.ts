import type { IActionJobData } from '@plumber/types'
import type { JobPro } from '@taskforcesh/bullmq-pro'

import { DELAY_STEP_GRACE_SECONDS } from '@/config/workers'
import logger from '@/helpers/logger'
import { incrementMetric } from '@/helpers/metrics'
import {
  makeRedisAppDataKey,
  redisAppDataClient,
} from '@/helpers/redis-app-data'
import tracer from '@/helpers/tracer'
import { makeActionJobId } from '@/queues/action'

const FIRST_START_MARKER_TTL_SECONDS = 24 * 60 * 60
// Matches the 30-day SLO window.
const LATE_EXECUTION_MARKER_TTL_SECONDS = 30 * 24 * 60 * 60

/**
 * Counts an execution as late when a job starts more than the grace period
 * after its scheduled time.
 *
 * IMPORTANT: never throws, so a metric failure cannot fail the step.
 */
export async function recordLateScheduledStart({
  job,
  queueName,
  groupLimited,
}: {
  job: JobPro<IActionJobData>
  queueName: string
  groupLimited: boolean
}): Promise<void> {
  const { flowId, executionId, stepId, scheduledAt, retryTimestamp } = job.data

  // Only consider jobs scheduled by a delay action, not jobs delayed by retries or rate limits.
  // IMPORTANT: a delay action's job that a rate limit holds back still counts as late.
  if (scheduledAt === undefined || retryTimestamp !== undefined) {
    return
  }

  try {
    // Stalls and rate-limit re-runs start the same job again later.
    const isFirstStart = await redisAppDataClient.set(
      makeRedisAppDataKey(
        'delay',
        `first-start:${makeActionJobId(queueName, job.id)}`,
      ),
      '1',
      'EX',
      FIRST_START_MARKER_TTL_SECONDS,
      'NX',
    )
    if (isFirstStart !== 'OK') {
      return
    }

    const latenessMs = Date.now() - scheduledAt
    tracer.scope().active()?.setTag('delay.lateness_ms', latenessMs)

    if (latenessMs <= DELAY_STEP_GRACE_SECONDS * 1000) {
      return
    }

    // The SLA counts executions, so a second late step in the same execution does not count again.
    const isFirstLateStep = await redisAppDataClient.set(
      makeRedisAppDataKey('delay', `late-execution:${executionId}`),
      '1',
      'EX',
      LATE_EXECUTION_MARKER_TTL_SECONDS,
      'NX',
    )
    if (isFirstLateStep !== 'OK') {
      return
    }

    incrementMetric('plumber.executions.late', {
      group_limited: String(groupLimited),
    })
    logger.warn('Step after a delay step started late', {
      event: 'late-execution',
      flowId,
      executionId,
      stepId,
      queueName,
      groupLimited,
      latenessMs,
    })
  } catch (err) {
    logger.error('Failed to record late execution', {
      event: 'late-execution-record-failed',
      err,
      flowId,
      executionId,
      stepId,
      queueName,
    })
  }
}
