import type { Redis } from 'ioredis'

import logger from '@/helpers/logger'
import { setGaugeMetric } from '@/helpers/metrics'

import type { ReconcilerCheck } from '../run-loop'
import { classifySchedules, parseScheduleEntries } from './classify-schedules'
import { collectMissedRuns } from './collect-missed-runs'
import type { ScheduleCheckConfig } from './config'
import { countMissedRuns } from './count-missed-runs'
import { fetchPublishedScheduledPipes } from './fetch-published-scheduled-pipes'
import { FLOW_QUEUE_KEY_PREFIX } from './is-run-time-job-pending'

export const SCHEDULE_ENTRIES_KEY = `${FLOW_QUEUE_KEY_PREFIX}:repeat`

interface CreateScheduleCheckInput {
  jobsRedis: Pick<Redis, 'zrange' | 'hmget'>
  markerRedis: Pick<Redis, 'set'>
  config: ScheduleCheckConfig
}

export function createScheduleCheck({
  jobsRedis,
  markerRedis,
  config,
}: CreateScheduleCheckInput): ReconcilerCheck {
  return {
    name: 'schedules',
    intervalSeconds: config.checkIntervalSeconds,
    run: async () => {
      // Postgres first: publishing writes the schedule entry before its transaction commits.
      const publishedPipes = await fetchPublishedScheduledPipes()
      const zrangeWithScores = await jobsRedis.zrange(
        SCHEDULE_ENTRIES_KEY,
        0,
        -1,
        'WITHSCORES',
      )

      const scheduleEntryByFlowId = parseScheduleEntries(zrangeWithScores)
      const nowMillis = Date.now()

      const { missingFlowIds, overdueFlowIds } = classifySchedules({
        publishedFlowIds: publishedPipes.map((pipe) => pipe.flowId),
        scheduleEntryByFlowId,
        nowMillis,
        graceSeconds: config.missedRunGraceSeconds,
      })

      const missedRuns = await collectMissedRuns({
        jobsRedis,
        publishedPipes,
        scheduleEntryByFlowId,
        missingFlowIds,
        overdueFlowIds,
        nowMillis,
        graceSeconds: config.missedRunGraceSeconds,
      })
      const newlyCountedMissedRuns = await countMissedRuns({
        markerRedis,
        missedRuns,
      })

      // Gauges go last, so a failure anywhere in the check trips the no-data monitor.
      setGaugeMetric('plumber.schedules.missing', missingFlowIds.length)
      setGaugeMetric('plumber.schedules.overdue', overdueFlowIds.length)

      const logDetails = {
        event: 'reconciler-schedule-check',
        publishedPipeCount: publishedPipes.length,
        missingCount: missingFlowIds.length,
        overdueCount: overdueFlowIds.length,
        missingFlowIds,
        overdueFlowIds,
        newlyCountedMissedRunCount: newlyCountedMissedRuns.length,
      }
      if (missingFlowIds.length > 0 || overdueFlowIds.length > 0) {
        logger.warn('Schedule check found problem pipes', logDetails)
      } else {
        logger.info('Schedule check found no problem pipes', logDetails)
      }
    },
  }
}
