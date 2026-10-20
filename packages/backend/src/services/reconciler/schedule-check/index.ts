import type { Redis } from 'ioredis'

import logger from '@/helpers/logger'
import { setGaugeMetric } from '@/helpers/metrics'

import type { ReconcilerCheck } from '../run-loop'
import { classifySchedules, parseScheduleEntries } from './classify-schedules'
import type { ScheduleCheckConfig } from './config'
import { fetchPublishedScheduledPipes } from './fetch-published-scheduled-pipes'

export const SCHEDULE_ENTRIES_KEY = '{flowQ}:flow:repeat'

interface CreateScheduleCheckInput {
  jobsRedis: Pick<Redis, 'zrange'>
  config: ScheduleCheckConfig
}

export function createScheduleCheck({
  jobsRedis,
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

      const { missingFlowIds, overdueFlowIds } = classifySchedules({
        publishedFlowIds: publishedPipes.map((pipe) => pipe.flowId),
        nextRunTimeByFlowId: parseScheduleEntries(zrangeWithScores),
        nowMillis: Date.now(),
        graceSeconds: config.missedRunGraceSeconds,
      })

      setGaugeMetric('plumber.schedules.missing', missingFlowIds.length)
      setGaugeMetric('plumber.schedules.overdue', overdueFlowIds.length)

      const logDetails = {
        event: 'reconciler-schedule-check',
        publishedPipeCount: publishedPipes.length,
        missingCount: missingFlowIds.length,
        overdueCount: overdueFlowIds.length,
        missingFlowIds,
        overdueFlowIds,
      }
      if (missingFlowIds.length > 0 || overdueFlowIds.length > 0) {
        logger.warn('Schedule check found problem pipes', logDetails)
      } else {
        logger.info('Schedule check found no problem pipes', logDetails)
      }
    },
  }
}
