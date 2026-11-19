import type { CloudWatchLogsClient } from '@aws-sdk/client-cloudwatch-logs'
import type { S3Client } from '@aws-sdk/client-s3'
import { BaseStep } from '@plumber/backend-models'
import type { Knex } from 'knex'
import { DateTime } from 'luxon'
import { z } from 'zod'

import {
  type CompletionSource,
  markDayComplete,
  planDays,
  runWithCoverage,
  writeEachDay,
} from '../day-completion'
import {
  EXPORT_APP_ENVS,
  s3Sink,
  type SilverSink,
} from '../export-silver-tables'
import logger from '../logger'
import { s3KeyLister } from '../silver-change-tables'
import {
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

// Bump when a day's files change. The next night replays the last 7 days from the log, which is append-only.
export const MUTATION_LOG_VERSION = 1

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

// Maps step ids to their pipe ids. The editor's deleteStep sends step ids without the pipe.
export type ResolveFlowIds = (stepIds: string[]) => Promise<Map<string, string>>

// The log keeps rejected mutations, so a step id may be any short string. A non-UUID would fail the whole query.
const stepIdSchema = z.uuid()

export function dbFlowIdResolver(db: Knex): ResolveFlowIds {
  return async (candidateIds) => {
    const stepIds = candidateIds.filter(
      (id) => stepIdSchema.safeParse(id).success,
    )
    if (stepIds.length === 0) {
      return new Map()
    }
    // A deleted step is soft-deleted, so it keeps its pipe.
    const steps = await BaseStep.query(db)
      .withSoftDeleted()
      .whereIn('id', stepIds)
      .select('id', 'flow_id')
    return new Map(steps.map((step) => [step.id, step.flowId]))
  }
}

async function fillFlowIds(
  rows: MutationLogRow[],
  resolveFlowIds: ResolveFlowIds,
): Promise<MutationLogRow[]> {
  // Postgres returns UUIDs in lowercase, so the lookup key is lowercased. The logged step_id is kept as is.
  const stepIds = [
    ...new Set(
      rows.flatMap((row) =>
        !row.flow_id && row.step_id ? [row.step_id.toLowerCase()] : [],
      ),
    ),
  ]
  const flowIdByStep = await resolveFlowIds(stepIds)
  return rows.map((row) =>
    !row.flow_id && row.step_id
      ? {
          ...row,
          flow_id: flowIdByStep.get(row.step_id.toLowerCase()) ?? null,
        }
      : row,
  )
}

interface WriteMutationLogDaysParams {
  fetchDayLines: FetchDayLines
  resolveFlowIds: ResolveFlowIds
  sink: SilverSink
  days: string[]
  source?: CompletionSource
  parameterByAction?: Record<string, string>
}

export async function writeMutationLogDays({
  fetchDayLines,
  resolveFlowIds,
  sink,
  days,
  source = 'backfill',
  parameterByAction = resourceParameters(readActionCatalog()),
}: WriteMutationLogDaysParams): Promise<void> {
  await writeEachDay(
    MUTATION_LOG_TABLE,
    days,
    (day) => day,
    async (day) => {
      const lines = await fetchDayLines(sgtDayWindow(day))
      const parsedRows = lines
        .map((line) => toMutationLogRow(line, parameterByAction))
        .filter((row): row is MutationLogRow => row !== null)
      const rows = sortForFlowSearch(
        await fillFlowIds(parsedRows, resolveFlowIds),
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
        rowsWithFlowFromStep:
          rows.filter((row) => row.flow_id).length -
          parsedRows.filter((row) => row.flow_id).length,
        // Ids for these came from recoverVariables. Their step resource is unknown.
        rowsWithUnreadableVariables: lines.filter(
          (line) =>
            recoverVariables(line.variables) !== null &&
            parseVariables(line.variables) === null,
        ).length,
      })

      await markDayComplete({
        sink,
        job: MUTATION_LOG_TABLE,
        completion: { day, version: MUTATION_LOG_VERSION, full: false },
        source,
        outputs: [key],
      })
    },
  )
}

interface ExportMutationLogParams {
  db: Knex
  logsClient: Pick<CloudWatchLogsClient, 'send'>
  s3Client: S3Client
  appEnv: string
  bucket: string | undefined
  logGroup: string | undefined
  // `through` redoes every day in the catch-up window, up to that day, with no current completion file.
  days: string[] | { through: string }
}

export async function exportMutationLog({
  db,
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
  const yesterday = Array.isArray(days)
    ? previousSgtDay(new Date())
    : days.through
  const sink = s3Sink(s3Client, bucket)
  await runWithCoverage(
    {
      job: MUTATION_LOG_TABLE,
      yesterday,
      version: MUTATION_LOG_VERSION,
      listKeys: s3KeyLister(s3Client, bucket),
      sink,
    },
    async (state) => {
      await writeMutationLogDays({
        fetchDayLines: logsInsightsFetcher(logsClient, logGroup),
        resolveFlowIds: dbFlowIdResolver(db),
        sink,
        days: Array.isArray(days)
          ? days
          : planDays(state, yesterday, MUTATION_LOG_VERSION).days,
        source: Array.isArray(days) ? 'backfill' : 'nightly',
      })
    },
  )
}
