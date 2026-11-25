import type { Knex } from 'knex'

import {
  completionPrefix,
  type CompletionSource,
  type CompletionStore,
  type JobState,
  loadJobState,
  markDayComplete,
  planDays,
  readJobState,
  runWithCoverage,
  writeEachDay,
} from './day-completion'
import type { SilverSink } from './export-silver-tables'
import logger from './logger'
import {
  addSgtDays,
  previousSgtDay,
  sgtDaysBetween,
  sgtDayWindow,
} from './sgt-day'
import {
  buildSilverDayKey,
  encodeSilverTable,
  type ParquetColumns,
  type SilverRow,
} from './silver-table'
import {
  type ExecutionDayQuery,
  fetchExecutionDaily,
  fetchExecutionInflight,
  fetchExecutionStepDaily,
  FINAL_LAG_DAYS,
} from './tables/executions'
import {
  EXECUTION_DAILY_COLUMNS,
  EXECUTION_INFLIGHT_COLUMNS,
  EXECUTION_STEP_DAILY_COLUMNS,
} from './tables/executions/schema'
import { writeEachTable } from './write-each-table'

/**
 * A table of execution counts, one file per Singapore day.
 *
 * A day is written provisionally the next night, then final once it is FINAL_LAG_DAYS old.
 * IMPORTANT: a final day is never rewritten, since archival may have deleted its runs since.
 */
export interface ExecutionDayTable<Row extends SilverRow> {
  name: string
  // Bump when the columns or query change. Only days not yet final take the new version.
  version: number
  columns: ParquetColumns<Row>
  fetchDay: (db: Knex, query: ExecutionDayQuery) => Promise<Row[]>
}

// Open runs can only be read as they are now, so a missed night stays missing.
export interface ExecutionSnapshotTable<Row extends SilverRow> {
  name: string
  version: number
  columns: ParquetColumns<Row>
  fetchSnapshot: (db: Knex, asOf: Date) => Promise<Row[]>
}

export const executionDailyTable: ExecutionDayTable<SilverRow> = {
  name: 'execution_daily',
  version: 1,
  columns: EXECUTION_DAILY_COLUMNS,
  fetchDay: fetchExecutionDaily,
}

export const executionStepDailyTable: ExecutionDayTable<SilverRow> = {
  name: 'execution_step_daily',
  version: 1,
  columns: EXECUTION_STEP_DAILY_COLUMNS,
  fetchDay: fetchExecutionStepDaily,
}

export const executionInflightTable: ExecutionSnapshotTable<SilverRow> = {
  name: 'execution_inflight',
  version: 1,
  columns: EXECUTION_INFLIGHT_COLUMNS,
  fetchSnapshot: fetchExecutionInflight,
}

export const EXECUTION_DAY_TABLES = [
  executionDailyTable,
  executionStepDailyTable,
]

export const EXECUTION_SNAPSHOT_TABLES = [executionInflightTable]

export function lastFinalDay(yesterday: string): string {
  return addSgtDays(yesterday, -(FINAL_LAG_DAYS - 1))
}

// Step statuses settle within minutes of a row, so a day's rows are settled by the start of the day after next.
export function finalAsOf(day: string): Date {
  return sgtDayWindow(addSgtDays(day, FINAL_LAG_DAYS)).start
}

/**
 * Picks the days to write as final, from the completion files, and the days still provisional.
 *
 * Final days catch up as far as planDays allows, skipping any day already final at any version.
 */
export function planExecutionDays(
  state: JobState,
  yesterday: string,
  version: number,
): { final: string[]; provisional: string[] } {
  const lastFinal = lastFinalDay(yesterday)
  const provisional: string[] = []
  for (let day = yesterday; day > lastFinal; day = addSgtDays(day, -1)) {
    provisional.unshift(day)
  }
  const final = planDays(state, lastFinal, version).days.filter(
    (day) => !state.newestVersion.has(day),
  )
  return { final, provisional }
}

async function writeDayFile({
  sink,
  table,
  day,
  rows,
  final,
}: {
  sink: SilverSink
  table: { name: string; columns: ParquetColumns<SilverRow> }
  day: string
  rows: SilverRow[]
  final: boolean
}): Promise<string> {
  const body = encodeSilverTable(
    { columns: { day: 'STRING', ...table.columns } },
    rows.map((row) => ({ day, ...row })),
  )
  const key = buildSilverDayKey(table.name, day)
  await sink(key, body)
  logger.info({
    event: 'analytics.export.day_file.written',
    table: table.name,
    key,
    day,
    final,
    rows: rows.length,
    bytes: body.length,
  })
  return key
}

interface WriteExecutionTablesParams {
  db: Knex
  sink: SilverSink
  store: CompletionStore
  yesterday: string
  now: Date
  dayTables?: ExecutionDayTable<SilverRow>[]
  snapshotTables?: ExecutionSnapshotTable<SilverRow>[]
  source?: CompletionSource
}

interface DayItem {
  day: string
  final: boolean
}

async function writeExecutionDayTable(
  {
    db,
    sink,
    store,
    yesterday,
    now,
    source = 'nightly',
    firstDay,
  }: WriteExecutionTablesParams & { firstDay?: string },
  table: ExecutionDayTable<SilverRow>,
  plan: (state: JobState) => DayItem[],
): Promise<void> {
  await runWithCoverage(
    {
      job: table.name,
      yesterday: lastFinalDay(yesterday),
      firstDay,
      version: table.version,
      store,
      sink,
    },
    async (state) => {
      await writeEachDay({
        job: table.name,
        state,
        version: table.version,
        items: plan(state),
        dayOf: (item) => item.day,
        write: async ({ day, final: isFinal }) => {
          const asOf = isFinal ? finalAsOf(day) : now
          if (asOf > now) {
            throw new Error(
              `${table.name} ${day} is not final until ${asOf.toISOString()}`,
            )
          }
          const rows = await table.fetchDay(db, {
            window: sgtDayWindow(day),
            asOf,
          })
          const key = await writeDayFile({
            sink,
            table,
            day,
            rows,
            final: isFinal,
          })
          if (isFinal) {
            await markDayComplete({
              sink,
              job: table.name,
              completion: { day, version: table.version, full: false },
              source,
              outputs: [key],
            })
          }
        },
      })
    },
  )
}

function nightlyPlan(
  yesterday: string,
  version: number,
  source: CompletionSource,
) {
  return (state: JobState): DayItem[] => {
    const { final, provisional } = planExecutionDays(state, yesterday, version)
    return [
      ...final.map((day) => ({ day, final: true })),
      // IMPORTANT: a final file shares its provisional file's key. A manual run's provisional upload could land after it.
      ...(source === 'nightly' ? provisional : []).map((day) => ({
        day,
        final: false,
      })),
    ]
  }
}

// A snapshot cannot be caught up, so coverage reports only last night.
async function writeExecutionSnapshotTable(
  {
    db,
    sink,
    store,
    yesterday,
    now,
    source = 'nightly',
  }: WriteExecutionTablesParams,
  table: ExecutionSnapshotTable<SilverRow>,
): Promise<void> {
  let written = false
  try {
    const state = await loadJobState(store, table.name, yesterday)
    written = state.completions.some(
      (completion) =>
        completion.day === yesterday && completion.version >= table.version,
    )
    if (written) {
      return
    }
    // Statuses can only be read as they are now, so the whole snapshot reads at export time.
    const rows = await table.fetchSnapshot(db, now)
    const key = await writeDayFile({
      sink,
      table,
      day: yesterday,
      rows,
      final: true,
    })
    await markDayComplete({
      sink,
      job: table.name,
      completion: { day: yesterday, version: table.version, full: false },
      source,
      outputs: [key],
    })
    written = true
  } finally {
    logger.info({
      event: 'analytics.export.coverage',
      job: table.name,
      missingDays: written ? 0 : 1,
      firstMissing: written ? null : yesterday,
      lastMissing: written ? null : yesterday,
      staleDays: 0,
    })
  }
}

export async function writeExecutionTables(
  params: WriteExecutionTablesParams,
): Promise<void> {
  const {
    dayTables = EXECUTION_DAY_TABLES,
    snapshotTables = EXECUTION_SNAPSHOT_TABLES,
    source = 'nightly',
  } = params
  if (source !== 'nightly' && snapshotTables.length > 0) {
    // A manual run would file daytime open runs under yesterday, and its completion file would stop the nightly snapshot.
    throw new Error(
      `${snapshotTables.map((table) => table.name).join(', ')} is written by the nightly run only`,
    )
  }
  const errors: Error[] = []
  await writeEachTable(dayTables, (table) =>
    writeExecutionDayTable(
      params,
      table,
      nightlyPlan(params.yesterday, table.version, source),
    ),
  ).catch((err: Error) => {
    errors.push(err)
  })
  await writeEachTable(snapshotTables, (table) =>
    writeExecutionSnapshotTable(params, table),
  ).catch((err: Error) => {
    errors.push(err)
  })
  if (errors.length > 0) {
    throw new Error(errors.map((err) => err.message).join('. '))
  }
}

export interface BackfillExecutionDaysParams {
  db: Knex
  sink: SilverSink
  store: CompletionStore
  days: string[]
  now?: Date
  dayTables?: ExecutionDayTable<SilverRow>[]
}

/**
 * Writes past days as final files, for history before the first night.
 *
 * Days already final at any version are skipped, so a rerun resumes where a stopped one left off.
 * Archival holds every run whose day is not final, so it deletes nothing until this covers the history.
 */
export async function backfillExecutionDays({
  db,
  sink,
  store,
  days,
  now = new Date(),
  dayTables = EXECUTION_DAY_TABLES,
}: BackfillExecutionDaysParams): Promise<void> {
  const yesterday = previousSgtDay(now)
  const lastFinal = lastFinalDay(yesterday)
  const late = days.filter((day) => day > lastFinal)
  if (late.length > 0) {
    throw new Error(
      `A backfill writes final days only. ${late[0]} is after ${lastFinal}.`,
    )
  }
  const params = {
    db,
    sink,
    store,
    yesterday,
    now,
    source: 'backfill' as const,
    firstDay: days[0],
  }
  await writeEachTable(dayTables, (table) =>
    writeExecutionDayTable(params, table, (state) => {
      const toWrite = days.filter((day) => !state.newestVersion.has(day))
      logger.info({
        event: 'analytics.execution_history.planned',
        table: table.name,
        requestedDays: days.length,
        skippedDays: days.length - toWrite.length,
        firstDay: toWrite[0] ?? null,
      })
      return toWrite.map((day) => ({ day, final: true }))
    }),
  )
}

// Plumber's first executions date from April 2023.
export const EXECUTION_HISTORY_START = '2023-04-01'

/**
 * The start of the earliest day, since the first execution, that has no final file in some execution day table.
 *
 * IMPORTANT: archival must keep every run that started or ran a step on or after this. Before the history
 * backfill, that is every run.
 */
export async function executionArchivalFloor(
  store: CompletionStore,
  now = new Date(),
  tables: ExecutionDayTable<SilverRow>[] = EXECUTION_DAY_TABLES,
): Promise<Date> {
  const lastFinal = lastFinalDay(previousSgtDay(now))
  const history = sgtDaysBetween(EXECUTION_HISTORY_START, lastFinal)
  let floor = addSgtDays(lastFinal, 1)
  for (const table of tables) {
    const objects = await store.list(completionPrefix(table.name))
    const { newestVersion } = readJobState(objects.map((object) => object.key))
    const missing = history.find((day) => !newestVersion.has(day))
    if (missing && missing < floor) {
      floor = missing
    }
  }
  return sgtDayWindow(floor).start
}
