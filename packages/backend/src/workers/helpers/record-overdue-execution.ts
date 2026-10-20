import type { IActionJobData } from '@plumber/types'
import type { JobPro } from '@taskforcesh/bullmq-pro'

import { OVERDUE_DELAY_STEP_THRESHOLD_SECONDS } from '@/config/workers'
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
const OVERDUE_EXECUTION_MARKER_TTL_SECONDS = 30 * 24 * 60 * 60

/**
 * Counts an execution as overdue when a step after a delay step starts too
 * late.
 *
 * IMPORTANT: never throws, so a metric failure cannot fail the step.
 */
export async function recordOverdueExecution({
  job,
  queueName,
  groupLimited,
}: {
  job: JobPro<IActionJobData>
  queueName: string
  groupLimited: boolean
}): Promise<void> {
  const { flowId, executionId, stepId, scheduledAt, retryTimestamp } = job.data

  // A retry starts on demand, not at the time the user scheduled.
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

    if (latenessMs <= OVERDUE_DELAY_STEP_THRESHOLD_SECONDS * 1000) {
      return
    }

    // The SLA counts executions, so later overdue steps in the same execution do not count again.
    const isFirstOverdueStep = await redisAppDataClient.set(
      makeRedisAppDataKey('delay', `overdue-execution:${executionId}`),
      '1',
      'EX',
      OVERDUE_EXECUTION_MARKER_TTL_SECONDS,
      'NX',
    )
    if (isFirstOverdueStep !== 'OK') {
      return
    }

    incrementMetric('plumber.executions.overdue', {
      group_limited: String(groupLimited),
    })
    logger.warn('Step after a delay step started late', {
      event: 'overdue-execution',
      flowId,
      executionId,
      stepId,
      queueName,
      groupLimited,
      latenessMs,
    })
  } catch (err) {
    logger.error('Failed to record overdue execution', {
      event: 'overdue-execution-record-failed',
      err,
      flowId,
      executionId,
      stepId,
      queueName,
    })
  }
}
