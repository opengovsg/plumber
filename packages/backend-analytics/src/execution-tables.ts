import type { Knex } from 'knex'

import {
  completionPrefix,
  COVERAGE_DAYS,
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
  historyBudgetMs?: number
  clock?: () => number
}

interface DayItem {
  day: string
  final: boolean
}

async function writeExecutionDay({
  db,
  sink,
  table,
  day,
  final,
  now,
  source,
}: {
  db: Knex
  sink: SilverSink
  table: ExecutionDayTable<SilverRow>
  day: string
  final: boolean
  now: Date
  source: CompletionSource
}): Promise<void> {
  const asOf = final ? finalAsOf(day) : now
  if (asOf > now) {
    throw new Error(
      `${table.name} ${day} is not final until ${asOf.toISOString()}`,
    )
  }
  const rows = await table.fetchDay(db, { window: sgtDayWindow(day), asOf })
  const key = await writeDayFile({ sink, table, day, rows, final })
  if (final) {
    await markDayComplete({
      sink,
      job: table.name,
      completion: { day, version: table.version, full: false },
      source,
      outputs: [key],
    })
  }
}

async function writeExecutionDayTable(
  {
    db,
    sink,
    store,
    yesterday,
    now,
    source = 'nightly',
  }: WriteExecutionTablesParams,
  table: ExecutionDayTable<SilverRow>,
  plan: (state: JobState) => DayItem[],
): Promise<void> {
  await runWithCoverage(
    {
      job: table.name,
      yesterday: lastFinalDay(yesterday),
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
        write: ({ day, final }) =>
          writeExecutionDay({ db, sink, table, day, final, now, source }),
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
  // Last, so a slow history night cannot delay yesterday's files.
  if (dayTables.length > 0) {
    await writeExecutionHistory({ ...params, dayTables }).catch(
      (err: Error) => {
        errors.push(err)
      },
    )
  }
  if (errors.length > 0) {
    throw new Error(errors.map((err) => err.message).join('. '))
  }
}

// Keeps the history's reader load inside the quiet hours after the 01:00 run, and each night's run shorter than a day.
export const EXECUTION_HISTORY_BUDGET_MS = 3 * 60 * 60 * 1_000

/**
 * Writes missing final days since EXECUTION_HISTORY_START until the night's time budget runs out.
 *
 * The last COVERAGE_DAYS go first, then the rest oldest first.
 *
 * Each day is written for every table before the next, since archival's floor is the earliest day either lacks.
 */
export async function writeExecutionHistory({
  db,
  sink,
  store,
  yesterday,
  now,
  dayTables = EXECUTION_DAY_TABLES,
  historyBudgetMs = EXECUTION_HISTORY_BUDGET_MS,
  clock = Date.now,
}: WriteExecutionTablesParams): Promise<void> {
  const deadline = clock() + historyBudgetMs
  const lastFinal = lastFinalDay(yesterday)
  const history = sgtDaysBetween(EXECUTION_HISTORY_START, lastFinal)
  // IMPORTANT: one history day moves coverage's expected start back to 2023, so the days it checks go first.
  // Oldest first would leave them missing, and the missing-days monitor would fire every night.
  const recentFrom = addSgtDays(lastFinal, -(COVERAGE_DAYS - 1))
  const order = [
    ...history.filter((day) => day >= recentFrom),
    ...history.filter((day) => day < recentFrom),
  ]
  const missing = await Promise.all(
    dayTables.map(async (table) => {
      const objects = await store.list(completionPrefix(table.name))
      const { newestVersion } = readJobState(objects.map((o) => o.key))
      return new Set(history.filter((day) => !newestVersion.has(day)))
    }),
  )
  const written = dayTables.map(() => 0)
  try {
    for (const day of order) {
      if (!missing.some((days) => days.has(day))) {
        continue
      }
      if (clock() >= deadline) {
        break
      }
      for (const [i, table] of dayTables.entries()) {
        if (!missing[i].has(day)) {
          continue
        }
        try {
          await writeExecutionDay({
            db,
            sink,
            table,
            day,
            final: true,
            now,
            source: 'backfill',
          })
        } catch (err) {
          // A failing day would fail again tonight, so the rest waits for the next night.
          logger.error({
            event: 'analytics.export.day.error',
            job: table.name,
            day,
            err,
          })
          throw new Error(`${table.name}: history day ${day} failed`)
        }
        missing[i].delete(day)
        written[i]++
      }
    }
  } finally {
    dayTables.forEach((table, i) => {
      logger.info({
        event: 'analytics.execution_history.progress',
        table: table.name,
        writtenDays: written[i],
        remainingDays: missing[i].size,
        firstMissing: [...missing[i]].sort()[0] ?? null,
      })
    })
  }
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
