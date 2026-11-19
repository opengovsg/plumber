import type { CloudWatchLogsClient } from '@aws-sdk/client-cloudwatch-logs'
import type { S3Client } from '@aws-sdk/client-s3'
import { DateTime } from 'luxon'

import {
  EXPORT_APP_ENVS,
  s3Sink,
  type SilverSink,
} from '../export-silver-tables'
import logger from '../logger'
import { s3KeyLister } from '../silver-change-tables'
import {
  BRONZE_PREFIX,
  buildBronzeDayKey,
  encodeParquet,
  type ParquetColumns,
} from '../silver-table'
import { readActionCatalog, resourceParameters } from '../tables/action-catalog'
import { fetchMutationLines } from './fetch-mutation-lines'
import {
  type MutationLogLine,
  type MutationLogRow,
  parseVariables,
  recoverVariables,
  toMutationLogRow,
} from './parse-mutation-line'

export const MUTATION_LOG_TABLE = 'mutation_log'

export const MUTATION_LOG_COLUMNS: ParquetColumns<MutationLogRow> = {
  ts: 'TIMESTAMP',
  user_id: 'STRING',
  operation: 'STRING',
  flow_id: 'STRING',
  step_id: 'STRING',
  table_id: 'STRING',
  connection_id: 'STRING',
  app_key: 'STRING',
  action_key: 'STRING',
  resource_id: 'STRING',
  http_status: 'INT64',
}

// About 7 groups on a busy day, so a search by flow_id reads one or two of them.
export const MUTATION_LOG_ROW_GROUP_SIZE = 2_000

// Rows of one pipe sit together, so each row group covers a narrow flow_id range.
export function sortForFlowSearch(rows: MutationLogRow[]): MutationLogRow[] {
  return [...rows].sort((a, b) => {
    if (a.flow_id !== b.flow_id) {
      if (a.flow_id === null) {
        return 1
      }
      if (b.flow_id === null) {
        return -1
      }
      return a.flow_id < b.flow_id ? -1 : 1
    }
    return a.ts.getTime() - b.ts.getTime()
  })
}

const ZONE = 'Asia/Singapore'
const DAY_FORMAT = 'yyyy-MM-dd'

export function sgtDayWindow(day: string): { startMs: number; endMs: number } {
  const start = DateTime.fromFormat(day, DAY_FORMAT, { zone: ZONE })
  if (!start.isValid) {
    throw new Error(`Invalid day "${day}". Use YYYY-MM-DD.`)
  }
  return {
    startMs: start.toMillis(),
    endMs: start.plus({ days: 1 }).toMillis(),
  }
}

export function previousSgtDay(now: Date): string {
  return DateTime.fromJSDate(now, { zone: ZONE })
    .minus({ days: 1 })
    .toFormat(DAY_FORMAT)
}

export function sgtDaysBetween(from: string, to: string): string[] {
  const start = DateTime.fromFormat(from, DAY_FORMAT, { zone: ZONE })
  const end = DateTime.fromFormat(to, DAY_FORMAT, { zone: ZONE })
  if (!start.isValid || !end.isValid || end < start) {
    throw new Error(`Invalid day range ${from} to ${to}`)
  }
  const days: string[] = []
  for (let day = start; day <= end; day = day.plus({ days: 1 })) {
    days.push(day.toFormat(DAY_FORMAT))
  }
  return days
}

// Each day costs one Logs Insights scan and runs before archival, so a long outage is left to a manual backfill.
export const MAX_CATCH_UP_DAYS = 7

const BRONZE_DAY_KEY = /\/day=(\d{4}-\d{2}-\d{2})\/current\.parquet$/

/**
 * Picks the days to extract: every day after the latest file already written, through yesterday.
 *
 * A night that failed is retried on the next run instead of staying missing.
 */
export function planMutationLogDays(
  existingKeys: string[],
  yesterday: string,
): { days: string[]; skipped: string[] } {
  const lastDay = existingKeys
    .map((key) => BRONZE_DAY_KEY.exec(key)?.[1])
    .filter((day): day is string => day !== undefined)
    .sort()
    .at(-1)
  if (!lastDay || lastDay >= yesterday) {
    return { days: lastDay ? [] : [yesterday], skipped: [] }
  }
  const pending = sgtDaysBetween(lastDay, yesterday).slice(1)
  return {
    days: pending.slice(-MAX_CATCH_UP_DAYS),
    skipped: pending.slice(0, -MAX_CATCH_UP_DAYS),
  }
}

export type FetchDayLines = (window: {
  startMs: number
  endMs: number
}) => Promise<MutationLogLine[]>

export function logsInsightsFetcher(
  client: Pick<CloudWatchLogsClient, 'send'>,
  logGroup: string,
): FetchDayLines {
  return (window) => fetchMutationLines({ client, logGroup, ...window })
}

interface WriteMutationLogDaysParams {
  fetchDayLines: FetchDayLines
  sink: SilverSink
  days: string[]
  parameterByAction?: Record<string, string>
}

export async function writeMutationLogDays({
  fetchDayLines,
  sink,
  days,
  parameterByAction = resourceParameters(readActionCatalog()),
}: WriteMutationLogDaysParams): Promise<void> {
  for (const day of days) {
    const lines = await fetchDayLines(sgtDayWindow(day))
    const rows = sortForFlowSearch(
      lines
        .map((line) => toMutationLogRow(line, parameterByAction))
        .filter((row): row is MutationLogRow => row !== null),
    )
    const key = buildBronzeDayKey(MUTATION_LOG_TABLE, day)
    await sink(
      key,
      encodeParquet(MUTATION_LOG_COLUMNS, rows, {
        rowGroupSize: MUTATION_LOG_ROW_GROUP_SIZE,
        bloomFilterColumns: ['flow_id'],
      }),
    )
    logger.info({
      event: 'analytics.mutation_log.day.written',
      day,
      key,
      lines: lines.length,
      rows: rows.length,
      rowsWithoutOperation: rows.filter((row) => !row.operation).length,
      rowsWithoutUser: rows.filter((row) => !row.user_id).length,
      // Ids for these came from recoverVariables. Their step resource is unknown.
      rowsWithUnreadableVariables: lines.filter(
        (line) =>
          recoverVariables(line.variables) !== null &&
          parseVariables(line.variables) === null,
      ).length,
    })
  }
}

interface ExportMutationLogParams {
  logsClient: Pick<CloudWatchLogsClient, 'send'>
  s3Client: S3Client
  appEnv: string
  bucket: string | undefined
  logGroup: string | undefined
  // `through` catches up every missing day up to that day, from the files already written.
  days: string[] | { through: string }
}

export async function exportMutationLog({
  logsClient,
  s3Client,
  appEnv,
  bucket,
  logGroup,
  days,
}: ExportMutationLogParams): Promise<void> {
  if (!EXPORT_APP_ENVS.has(appEnv)) {
    logger.info({ event: 'analytics.mutation_log.skipped', appEnv })
    return
  }
  if (!bucket || !logGroup) {
    throw new Error(
      `ANALYTICS_BUCKET and ANALYTICS_REQUEST_LOG_GROUP must be set in ${appEnv}`,
    )
  }
  let dayList: string[]
  if (Array.isArray(days)) {
    dayList = days
  } else {
    const existingKeys = await s3KeyLister(
      s3Client,
      bucket,
    )(`${BRONZE_PREFIX}${MUTATION_LOG_TABLE}/`)
    const plan = planMutationLogDays(existingKeys, days.through)
    if (plan.skipped.length > 0) {
      logger.warn({
        event: 'analytics.mutation_log.catch_up_capped',
        firstSkipped: plan.skipped[0],
        lastSkipped: plan.skipped.at(-1),
      })
    }
    dayList = plan.days
  }
  await writeMutationLogDays({
    fetchDayLines: logsInsightsFetcher(logsClient, logGroup),
    sink: s3Sink(s3Client, bucket),
    days: dayList,
  })
}
