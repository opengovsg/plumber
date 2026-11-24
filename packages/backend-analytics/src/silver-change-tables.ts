import type { Knex } from 'knex'

import {
  type CompletionSource,
  type CompletionStore,
  type DayCompletion,
  type JobState,
  latestFullCopy,
  markDayComplete,
  planDays,
  runWithCoverage,
  writeEachDay,
} from './day-completion'
import type { SilverSink } from './export-silver-tables'
import logger from './logger'
import { type SgtDayWindow, sgtDayWindow } from './sgt-day'
import {
  buildSilverDayKey,
  encodeSilverTable,
  type SilverRow,
  type SilverTable,
} from './silver-table'
import { writeEachTable } from './write-each-table'

/**
 * A table written as one file per Singapore day, holding only the rows that changed that day.
 *
 * PostHog bills every row it imports, so a full copy each night would bill the whole table daily.
 */
export interface SilverChangeTable<Row extends SilverRow> {
  name: string
  // Bump when the columns or query change, so the next run writes a new full copy.
  version: number
  columns: SilverTable<Row>['columns']
  // A null window asks for every row, for the first file or a re-baseline.
  // Each page becomes one file, so memory stays bounded however large the table grows.
  fetchPages: (db: Knex, window: SgtDayWindow | null) => AsyncIterable<Row[]>
}

export interface ChangeFilePlan {
  day: string
  full: boolean
}

// A day whose newest completion file was dropped cannot be rewritten alone, so a full copy repairs it. A later full copy already covers it.
function hasOutdatedDay(state: JobState, baseline: DayCompletion): boolean {
  const current = new Map<string, number>()
  for (const { day, version } of state.completions) {
    current.set(day, Math.max(version, current.get(day) ?? 0))
  }
  return [...state.newestVersion].some(
    ([day, version]) => day > baseline.day && (current.get(day) ?? 0) < version,
  )
}

/**
 * Picks the day files to write from the completion files.
 *
 * A missed day is written to each row's current state only. With no full copy yet, with `full`,
 * or after a version bump, a full copy of yesterday covers every earlier day.
 */
export function planChangeFiles(
  state: JobState,
  yesterday: string,
  full: boolean,
  version: number,
): ChangeFilePlan[] {
  const baseline = latestFullCopy(state.completions)
  if (
    full ||
    !baseline ||
    baseline.version < version ||
    hasOutdatedDay(state, baseline)
  ) {
    return [{ day: yesterday, full: true }]
  }
  // IMPORTANT: a finished day is never rewritten. A rerun reads rows' current updated_at, so it would drop rows edited since.
  const finished = new Set(
    state.completions.map((completion) => completion.day),
  )
  return planDays(state, yesterday, version)
    .days.filter((day) => !finished.has(day))
    .map((day) => ({ day, full: false }))
}

async function writeChangeFile({
  sink,
  table,
  day,
  part,
  rows,
  full,
}: {
  sink: SilverSink
  table: SilverChangeTable<SilverRow>
  day: string
  part?: number
  rows: SilverRow[]
  full: boolean
}): Promise<string> {
  // A full copy after a direct write repeats older rows' updated_at, so a view picks each row's latest by day first.
  const body = encodeSilverTable(
    { columns: { day: 'STRING', ...table.columns } },
    rows.map((row) => ({ day, ...row })),
  )
  const key = buildSilverDayKey(table.name, day, part)
  await sink(key, body)
  logger.info({
    event: 'analytics.export.change_file.written',
    table: table.name,
    key,
    full,
    rows: rows.length,
    bytes: body.length,
  })
  return key
}

async function writeChangeDay({
  db,
  sink,
  table,
  file,
  source,
}: {
  db: Knex
  sink: SilverSink
  table: SilverChangeTable<SilverRow>
  file: ChangeFilePlan
  source: CompletionSource
}): Promise<void> {
  const window = file.full ? null : sgtDayWindow(file.day)
  const write = (rows: SilverRow[], part?: number) =>
    writeChangeFile({ sink, table, day: file.day, part, rows, full: file.full })
  // The last page takes the unnumbered key, so a one-page day is a single file.
  const outputs: string[] = []
  let held: SilverRow[] = []
  let part = 0
  for await (const rows of table.fetchPages(db, window)) {
    if (part > 0) {
      outputs.push(await write(held, part))
    }
    held = rows
    part++
  }
  outputs.push(await write(held))
  await markDayComplete({
    sink,
    job: table.name,
    completion: { day: file.day, version: table.version, full: file.full },
    source,
    outputs,
  })
}

interface WriteSilverChangeTablesParams {
  db: Knex
  sink: SilverSink
  store: CompletionStore
  tables: SilverChangeTable<SilverRow>[]
  yesterday: string
  full?: boolean
  source?: CompletionSource
}

export async function writeSilverChangeTables({
  db,
  sink,
  store,
  tables,
  yesterday,
  full = false,
  source = 'nightly',
}: WriteSilverChangeTablesParams): Promise<void> {
  await writeEachTable(tables, (table) =>
    runWithCoverage(
      {
        job: table.name,
        yesterday,
        version: table.version,
        store,
        sink,
      },
      (state) =>
        writeEachDay({
          job: table.name,
          state,
          version: table.version,
          items: planChangeFiles(state, yesterday, full, table.version),
          dayOf: (file) => file.day,
          write: (file) => writeChangeDay({ db, sink, table, file, source }),
        }),
    ),
  )
}
