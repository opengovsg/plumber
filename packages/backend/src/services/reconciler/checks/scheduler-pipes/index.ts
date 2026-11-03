import type { Redis } from 'ioredis'

import logger from '@/helpers/logger'

import type { ReconcilerCheck } from '../../run-checks'
import { classifySchedules, parseScheduleEntries } from './classify-schedules'
import { collectMissedRuns } from './collect-missed-runs'
import type { SchedulerPipesCheckConfig } from './config'
import { countMissedRuns } from './count-missed-runs'
import { fetchPublishedScheduledPipes } from './fetch-published-scheduled-pipes'
import { FLOW_QUEUE_KEY_PREFIX } from './is-run-time-job-pending'

export const SCHEDULE_ENTRIES_KEY = `${FLOW_QUEUE_KEY_PREFIX}:repeat`

interface CreateSchedulerPipesCheckInput {
  jobsRedis: Pick<Redis, 'zrange' | 'hmget'>
  markerRedis: Pick<Redis, 'pipeline'>
  config: SchedulerPipesCheckConfig
}

export function createSchedulerPipesCheck({
  jobsRedis,
  markerRedis,
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

      const scheduleEntryByFlowId = parseScheduleEntries(zrangeWithScores)
      const nowMillis = Date.now()

      const { missingPipes, overduePipes } = classifySchedules({
        publishedPipes,
        scheduleEntryByFlowId,
        nowMillis,
        graceSeconds: config.missedRunGraceSeconds,
      })

      const missedRuns = await collectMissedRuns({
        jobsRedis,
        missingPipes,
        overduePipes,
        nowMillis,
        graceSeconds: config.missedRunGraceSeconds,
      })
      const newlyCountedMissedRunCount = await countMissedRuns({
        markerRedis,
        missedRuns,
        nowMillis,
      })

      // The heartbeat log goes last, so it marks a completed run.
      const logDetails = {
        event: 'reconciler-scheduler-pipes-check',
        publishedPipeCount: publishedPipes.length,
        missingCount: missingPipes.length,
        overdueCount: overduePipes.length,
        newlyCountedMissedRunCount,
      }
      if (missingPipes.length > 0 || overduePipes.length > 0) {
        logger.warn('Scheduler pipes check found problem pipes', logDetails)
      } else {
        logger.info('Scheduler pipes check found no problem pipes', logDetails)
      }
    },
  }
}
