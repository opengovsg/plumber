import type { CloudWatchLogsClient } from '@aws-sdk/client-cloudwatch-logs'
import type { S3Client } from '@aws-sdk/client-s3'
import { BaseStep, BaseUser } from '@plumber/backend-models'
import type { Knex } from 'knex'
import { z } from 'zod'

import {
  localDirCompletionStore,
  s3CompletionStore,
} from '../completion-stores'
import {
  type CompletionSource,
  type JobState,
  markDayComplete,
  planDays,
  runWithCoverage,
  writeEachDay,
} from '../day-completion'
import {
  EXPORT_APP_ENVS,
  localDirSink,
  s3Sink,
  type SilverSink,
} from '../export-silver-tables'
import logger from '../logger'
import { previousSgtDay, sgtDayWindow } from '../sgt-day'
import {
  buildBronzeDayKey,
  buildSilverDayKey,
  encodeParquet,
  type ParquetColumns,
} from '../silver-table'
import { readActionCatalog, resourceParameters } from '../tables/action-catalog'
import { fetchMcpToolLines, fetchMutationLines } from './fetch-mutation-lines'
import {
  FLOW_EDIT_DAILY_COLUMNS,
  FLOW_EDIT_DAILY_TABLE,
  summarizeFlowEdits,
} from './flow-edit-daily'
import {
  type McpToolLine,
  parseMcpToolLine,
  toMcpToolRow,
} from './parse-mcp-tool-line'
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

// Bump when a day's files change. The next night replays the last 7 days from the log, which is append-only.
// 2 adds flow_edit_daily. 3 adds AI builder tool calls.
export const MUTATION_LOG_VERSION = 3

export interface DayLines {
  mutationLines: MutationLogLine[]
  mcpToolLines: McpToolLine[]
}

export type FetchDayLines = (window: {
  startMs: number
  endMs: number
}) => Promise<DayLines>

export function logsInsightsFetcher(
  client: Pick<CloudWatchLogsClient, 'send'>,
  logGroup: string,
  signal?: AbortSignal,
): FetchDayLines {
  return async (window) => ({
    mutationLines: await fetchMutationLines({
      client,
      logGroup,
      signal,
      ...window,
    }),
    mcpToolLines: await fetchMcpToolLines({
      client,
      logGroup,
      signal,
      ...window,
    }),
  })
}

// Maps lowercase emails to user ids. The AI builder's usage log names users by email.
export type ResolveUserIds = (emails: string[]) => Promise<Map<string, string>>

export function dbUserIdResolver(db: Knex): ResolveUserIds {
  return async (emails) => {
    if (emails.length === 0) {
      return new Map()
    }
    const users = await BaseUser.query(db)
      .withSoftDeleted()
      .whereIn(db.raw('lower(email)'), emails)
      .select('id', 'email')
    return new Map(users.map((user) => [user.email.toLowerCase(), user.id]))
  }
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
  resolveUserIds: ResolveUserIds
  sink: SilverSink
  state: JobState
  days: string[]
  source?: CompletionSource
  parameterByAction?: Record<string, string>
}

export async function writeMutationLogDays({
  fetchDayLines,
  resolveFlowIds,
  resolveUserIds,
  sink,
  state,
  days,
  source = 'backfill',
  parameterByAction = resourceParameters(readActionCatalog()),
}: WriteMutationLogDaysParams): Promise<void> {
  await writeEachDay({
    job: MUTATION_LOG_TABLE,
    state,
    version: MUTATION_LOG_VERSION,
    items: days,
    dayOf: (day) => day,
    write: async (day) => {
      const { start, end } = sgtDayWindow(day)
      const { mutationLines: lines, mcpToolLines } = await fetchDayLines({
        startMs: start.getTime(),
        endMs: end.getTime(),
      })
      const mcpToolCalls = mcpToolLines
        .map(parseMcpToolLine)
        .filter((call) => call !== null)
      const userIdByEmail = await resolveUserIds([
        ...new Set(
          mcpToolCalls.flatMap((call) =>
            call.userEmail ? [call.userEmail] : [],
          ),
        ),
      ])
      const mcpToolRows = mcpToolCalls.map((call) =>
        toMcpToolRow(call, userIdByEmail),
      )
      const parsedRows = [
        ...lines
          .map((line) => toMutationLogRow(line, parameterByAction))
          .filter((row): row is MutationLogRow => row !== null),
        ...mcpToolRows,
      ]
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
        mcpToolLines: mcpToolLines.length,
        mcpToolRows: mcpToolRows.length,
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

      const edits = summarizeFlowEdits(day, rows)
      const editsKey = buildSilverDayKey(FLOW_EDIT_DAILY_TABLE, day)
      await sink(editsKey, encodeParquet(FLOW_EDIT_DAILY_COLUMNS, edits))
      logger.info({
        event: 'analytics.flow_edit_daily.day.written',
        day,
        key: editsKey,
        rows: edits.length,
      })

      await markDayComplete({
        sink,
        job: MUTATION_LOG_TABLE,
        completion: { day, version: MUTATION_LOG_VERSION, full: false },
        source,
        outputs: [key, editsKey],
      })
    },
  })
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
  // Aborting fails the days still unwritten, so a stalled Logs Insights call cannot hold up archival.
  signal?: AbortSignal
}

export async function exportMutationLog({
  db,
  logsClient,
  s3Client,
  appEnv,
  bucket,
  logGroup,
  days,
  signal,
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
      firstDay: Array.isArray(days)
        ? ([...days].sort()[0] ?? yesterday)
        : yesterday,
      version: MUTATION_LOG_VERSION,
      store: s3CompletionStore(s3Client, bucket),
      sink,
    },
    async (state) => {
      await writeMutationLogDays({
        fetchDayLines: logsInsightsFetcher(logsClient, logGroup, signal),
        resolveFlowIds: dbFlowIdResolver(db),
        resolveUserIds: dbUserIdResolver(db),
        sink,
        state,
        days: Array.isArray(days)
          ? days
          : planDays(state, yesterday, MUTATION_LOG_VERSION).days,
        source: Array.isArray(days) ? 'backfill' : 'nightly',
      })
    },
  )
}

interface ExportMutationLogToDirParams {
  dir: string
  fetchDayLines: FetchDayLines
  resolveFlowIds: ResolveFlowIds
  resolveUserIds: ResolveUserIds
  days: string[]
}

// Keeps completion files in the folder, so a local run passes the same version checks as the nightly export.
export async function exportMutationLogToDir({
  dir,
  fetchDayLines,
  resolveFlowIds,
  resolveUserIds,
  days,
}: ExportMutationLogToDirParams): Promise<void> {
  const sink = localDirSink(dir)
  await runWithCoverage(
    {
      job: MUTATION_LOG_TABLE,
      yesterday: previousSgtDay(new Date()),
      firstDay: [...days].sort()[0],
      version: MUTATION_LOG_VERSION,
      store: localDirCompletionStore(dir),
      sink,
    },
    (state) =>
      writeMutationLogDays({
        fetchDayLines,
        resolveFlowIds,
        resolveUserIds,
        sink,
        state,
        days,
      }),
  )
}
