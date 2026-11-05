import type { Redis } from 'ioredis'

import logger from '@/helpers/logger'

import type { ReconcilerCheck } from '../../run-checks'
import { classifySchedules, parseScheduleEntries } from './classify-schedules'
import type { SchedulerPipesCheckConfig } from './config'
import { fetchPublishedScheduledPipes } from './fetch-published-scheduled-pipes'

export const SCHEDULE_ENTRIES_KEY = '{flowQ}:flow:repeat'

interface CreateSchedulerPipesCheckInput {
  jobsRedis: Pick<Redis, 'zrange'>
  config: SchedulerPipesCheckConfig
}

export function createSchedulerPipesCheck({
  jobsRedis,
  config,
}: CreateSchedulerPipesCheckInput): ReconcilerCheck {
  return {
    name: 'scheduler-pipes',
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
        scheduleEntryByFlowId: parseScheduleEntries(zrangeWithScores),
        nowMillis: Date.now(),
        graceSeconds: config.missedRunGraceSeconds,
      })

      // The heartbeat log goes last, so it marks a completed run.
      const logDetails = {
        event: 'reconciler-scheduler-pipes-check',
        publishedPipeCount: publishedPipes.length,
        missingCount: missingFlowIds.length,
        overdueCount: overdueFlowIds.length,
      }
      if (missingFlowIds.length > 0 || overdueFlowIds.length > 0) {
        logger.warn('Scheduler pipes check found problem pipes', logDetails)
      } else {
        logger.info('Scheduler pipes check found no problem pipes', logDetails)
      }
    },
  }
}
