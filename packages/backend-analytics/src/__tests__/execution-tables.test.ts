import { mkdtemp, readdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

import type { Knex } from 'knex'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { localDirCompletionStore } from '../completion-stores'
import {
  checkCoverage,
  type CompletionSource,
  loadJobState,
  readJobState,
} from '../day-completion'
import {
  EXECUTION_HISTORY_MAX_FAILURES,
  EXECUTION_HISTORY_START,
  writeExecutionHistory,
  executionArchivalFloor,
  type ExecutionDayTable,
  type ExecutionSnapshotTable,
  finalAsOf,
  planExecutionDays,
  writeExecutionTables,
} from '../execution-tables'
import { localDirSink } from '../export-silver-tables'
import logger from '../logger'
import { sgtDaysBetween, sgtDayWindow } from '../sgt-day'

vi.mock('../logger')

let dir: string | undefined

afterEach(async () => {
  vi.clearAllMocks()
  if (dir) {
    await rm(dir, { recursive: true, force: true })
    dir = undefined
  }
})

const db = {} as Knex
const YESTERDAY = '2026-11-10'
// 01:00 on 11 Nov in Singapore, when the nightly task runs.
const NOW = new Date('2026-11-10T17:00:00.000Z')

describe('planExecutionDays', () => {
  it('writes yesterday provisionally and the day before as final', () => {
    expect(planExecutionDays(readJobState([]), YESTERDAY, 1)).toEqual({
      final: ['2026-11-09'],
      provisional: ['2026-11-10'],
    })
  })

  it('catches up final days that have no completion file', () => {
    const state = {
      ...readJobState([]),
      startDay: '2026-11-06',
      completions: [{ day: '2026-11-06', version: 1, full: false }],
    }

    expect(planExecutionDays(state, YESTERDAY, 1).final).toEqual([
      '2026-11-07',
      '2026-11-08',
      '2026-11-09',
    ])
  })

  it('never rewrites a final day after a version bump', () => {
    const state = readJobState([
      'bronze/_completion/execution_daily/start=2026-11-07.json',
      'bronze/_completion/execution_daily/day=2026-11-07.v1.json',
      'bronze/_completion/execution_daily/day=2026-11-08.v1.json',
    ])

    expect(planExecutionDays(state, YESTERDAY, 2).final).toEqual(['2026-11-09'])
  })
})

describe('finalAsOf', () => {
  it('reads a day as it stood at the start of the day after next', () => {
    expect(finalAsOf('2026-11-09')).toEqual(
      new Date('2026-11-10T16:00:00.000Z'),
    )
  })
})

describe('writeExecutionTables', () => {
  function dayTable(): ExecutionDayTable<{ id: string }> {
    return {
      name: 'execution_daily',
      version: 1,
      columns: { id: 'STRING' },
      fetchDay: vi.fn(async () => [{ id: 'row' }]),
    }
  }

  function snapshotTable(): ExecutionSnapshotTable<{ id: string }> {
    return {
      name: 'execution_inflight',
      version: 1,
      columns: { id: 'STRING' },
      fetchSnapshot: vi.fn(async () => [{ id: 'open' }]),
    }
  }

  async function write(
    dayTables: ExecutionDayTable<{ id: string }>[],
    snapshotTables: ExecutionSnapshotTable<{ id: string }>[],
    source: CompletionSource = 'nightly',
  ) {
    dir ??= await mkdtemp(path.join(tmpdir(), 'executions-'))
    await writeExecutionTables({
      db,
      sink: localDirSink(dir),
      store: localDirCompletionStore(dir),
      yesterday: YESTERDAY,
      now: NOW,
      dayTables,
      snapshotTables,
      source,
      // The history is covered by its own tests below.
      historyBudgetMs: 0,
    })
  }

  it('marks only the final day complete, reading it at its final time', async () => {
    const table = dayTable()

    await write([table], [])

    expect(table.fetchDay).toHaveBeenCalledWith(db, {
      window: sgtDayWindow('2026-11-09'),
      asOf: finalAsOf('2026-11-09'),
    })
    expect(table.fetchDay).toHaveBeenCalledWith(db, {
      window: sgtDayWindow('2026-11-10'),
      asOf: NOW,
    })
    expect(
      (await readdir(path.join(dir!, 'silver/execution_daily'))).sort(),
    ).toEqual(['day=2026-11-09.parquet', 'day=2026-11-10.parquet'])
    expect(
      (await readdir(path.join(dir!, 'bronze/_completion/execution_daily')))
        .filter((key) => key.startsWith('day='))
        .sort(),
    ).toEqual(['day=2026-11-09.v1.json'])
  })

  it('rewrites a provisional day as final the next night, and never a final day', async () => {
    const table = dayTable()
    await write([table], [])
    vi.mocked(table.fetchDay).mockClear()

    dir = dir!
    await writeExecutionTables({
      db,
      sink: localDirSink(dir),
      store: localDirCompletionStore(dir),
      yesterday: '2026-11-11',
      now: new Date('2026-11-11T17:00:00.000Z'),
      dayTables: [table],
      snapshotTables: [],
      historyBudgetMs: 0,
    })

    expect(
      vi.mocked(table.fetchDay).mock.calls.map(([, query]) => query.window),
    ).toEqual([sgtDayWindow('2026-11-10'), sgtDayWindow('2026-11-11')])
  })

  it('writes only final days outside the nightly run', async () => {
    const table = dayTable()

    await write([table], [], 'backfill')

    expect(await readdir(path.join(dir!, 'silver/execution_daily'))).toEqual([
      'day=2026-11-09.parquet',
    ])
  })

  it('refuses the snapshot outside the nightly run', async () => {
    const snapshot = snapshotTable()

    await expect(write([], [snapshot], 'backfill')).rejects.toThrow(
      'execution_inflight is written by the nightly run only',
    )

    expect(snapshot.fetchSnapshot).not.toHaveBeenCalled()
  })

  it('runs the history in the nightly export', async () => {
    await write([dayTable()], [])

    expect(logger.info).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'analytics.execution_history.progress',
        table: 'execution_daily',
        writtenDays: 0,
        firstMissing: EXECUTION_HISTORY_START,
      }),
    )
  })

  it('still writes the snapshot when a day table fails', async () => {
    const table = dayTable()
    vi.mocked(table.fetchDay).mockRejectedValue(new Error('statement timeout'))
    const snapshot = snapshotTable()

    await expect(write([table], [snapshot])).rejects.toThrow(
      'Analytics tables failed: execution_daily',
    )

    expect(snapshot.fetchSnapshot).toHaveBeenCalledWith(db, NOW)
  })

  it('takes the snapshot once per night', async () => {
    const snapshot = snapshotTable()

    await write([], [snapshot])
    await write([], [snapshot])

    expect(snapshot.fetchSnapshot).toHaveBeenCalledTimes(1)
  })

  it('reports a failed snapshot as one missing night', async () => {
    const snapshot = snapshotTable()
    vi.mocked(snapshot.fetchSnapshot).mockRejectedValue(new Error('timeout'))

    await expect(write([], [snapshot])).rejects.toThrow(
      'Analytics tables failed: execution_inflight',
    )

    expect(logger.info).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'analytics.export.coverage',
        job: 'execution_inflight',
        missingDays: 1,
        firstMissing: YESTERDAY,
      }),
    )
  })
})

// Holds files in memory, since the history and the floor read one completion file per day back to 2023.
function memoryBucket() {
  const files = new Map<string, { body: Buffer; at: Date }>()
  const sink = async (key: string, body: Buffer) => {
    files.set(key, { body, at: new Date() })
  }
  const store = {
    list: async (prefix: string) =>
      [...files]
        .filter(([key]) => key.startsWith(prefix))
        .map(([key, file]) => ({ key, lastModified: file.at })),
    read: async (key: string) => files.get(key)?.body ?? null,
    lastModified: async (key: string) => files.get(key)?.at ?? null,
  }
  const seed = (job: string, days: string[]) => {
    for (const d of days) {
      files.set(`bronze/_completion/${job}/day=${d}.v1.json`, {
        body: Buffer.from('{"outputs":[]}'),
        at: new Date(0),
      })
    }
  }
  const completed = (job: string) =>
    [...files.keys()]
      .filter((key) => key.startsWith(`bronze/_completion/${job}/day=`))
      .map((key) => key.slice(key.lastIndexOf('/') + 1))
      .sort()
  return { sink, store, seed, completed }
}

describe('executionArchivalFloor', () => {
  const tables = [
    { name: 'execution_daily' },
    { name: 'execution_step_daily' },
  ] as ExecutionDayTable<{ id: string }>[]
  const historyTo = (day: string) =>
    sgtDaysBetween(EXECUTION_HISTORY_START, day)

  it('keeps every run until the history is written', async () => {
    expect(
      await executionArchivalFloor(memoryBucket().store, NOW, tables),
    ).toEqual(sgtDayWindow(EXECUTION_HISTORY_START).start)
  })

  it('starts at the earliest day either table has not finalised', async () => {
    const bucket = memoryBucket()
    bucket.seed('execution_daily', historyTo('2026-11-09'))
    bucket.seed('execution_step_daily', historyTo('2026-11-07'))

    expect(await executionArchivalFloor(bucket.store, NOW, tables)).toEqual(
      sgtDayWindow('2026-11-08').start,
    )
  })

  it('starts after the last final day once every day is final', async () => {
    const bucket = memoryBucket()
    bucket.seed('execution_daily', historyTo('2026-11-09'))
    bucket.seed('execution_step_daily', historyTo('2026-11-09'))

    expect(await executionArchivalFloor(bucket.store, NOW, tables)).toEqual(
      sgtDayWindow('2026-11-10').start,
    )
  })
})

describe('writeExecutionHistory', () => {
  const day = (id: string): ExecutionDayTable<{ id: string }> => ({
    name: id,
    version: 1,
    columns: { id: 'STRING' },
    fetchDay: vi.fn(async () => [{ id: 'row' }]),
  })

  function history(
    bucket: ReturnType<typeof memoryBucket>,
    tables: ExecutionDayTable<{ id: string }>[],
    {
      budgetMs = 60_000,
      clock = (): number => 0,
      signal,
    }: { budgetMs?: number; clock?: () => number; signal?: AbortSignal } = {},
  ) {
    return writeExecutionHistory({
      db,
      sink: bucket.sink,
      store: bucket.store,
      yesterday: YESTERDAY,
      now: NOW,
      dayTables: tables,
      historyBudgetMs: budgetMs,
      clock,
      signal,
    })
  }

  // Counts time in fetches, so a budget reads as a number of day writes.
  function ticking(table: ExecutionDayTable<{ id: string }>) {
    let now = 0
    vi.mocked(table.fetchDay).mockImplementation(async () => {
      now += 10
      return []
    })
    return () => now
  }

  it('writes every table for a day before the next, at the final time', async () => {
    const bucket = memoryBucket()
    const order: string[] = []
    const tables = ['execution_daily', 'execution_step_daily'].map((name) => {
      const table = day(name)
      vi.mocked(table.fetchDay).mockImplementation(async (_db, query) => {
        order.push(`${name} ${query.window.start.toISOString()}`)
        return []
      })
      return table
    })
    const done = sgtDaysBetween(EXECUTION_HISTORY_START, '2026-11-06')
    bucket.seed('execution_daily', done)
    bucket.seed('execution_step_daily', [...done, '2026-11-07'])

    await history(bucket, tables)

    expect(order).toEqual([
      `execution_daily ${sgtDayWindow('2026-11-07').start.toISOString()}`,
      `execution_daily ${sgtDayWindow('2026-11-08').start.toISOString()}`,
      `execution_step_daily ${sgtDayWindow('2026-11-08').start.toISOString()}`,
      `execution_daily ${sgtDayWindow('2026-11-09').start.toISOString()}`,
      `execution_step_daily ${sgtDayWindow('2026-11-09').start.toISOString()}`,
    ])
    expect(tables[0].fetchDay).toHaveBeenCalledWith(db, {
      window: sgtDayWindow('2026-11-07'),
      asOf: finalAsOf('2026-11-07'),
    })
  })

  it('writes the days coverage checks first, so the missing-days monitor stays quiet', async () => {
    const bucket = memoryBucket()
    const table = day('execution_daily')
    // The first night wrote its start marker and its one final day.
    await bucket.sink(
      'bronze/_completion/execution_daily/start=2026-11-09.json',
      Buffer.from('{}'),
    )
    bucket.seed('execution_daily', ['2026-11-09'])
    const clock = ticking(table)

    // 40 writes: the 29 missing days of the coverage window, then 11 from April 2023.
    await history(bucket, [table], { budgetMs: 400, clock })

    const state = await loadJobState(
      bucket.store,
      'execution_daily',
      '2026-11-09',
    )
    expect(checkCoverage(state, '2026-11-09', 1).missing).toEqual([])
    expect(vi.mocked(table.fetchDay).mock.calls.at(-1)?.[1].window).toEqual(
      sgtDayWindow('2023-04-11'),
    )
  })

  it('stops at the time budget and reports what is left', async () => {
    const bucket = memoryBucket()
    const table = day('execution_daily')
    bucket.seed(
      'execution_daily',
      sgtDaysBetween(EXECUTION_HISTORY_START, '2026-11-01'),
    )
    const clock = ticking(table)

    await history(bucket, [table], { budgetMs: 25, clock })

    expect(table.fetchDay).toHaveBeenCalledTimes(3)
    expect(logger.info).toHaveBeenCalledWith({
      event: 'analytics.execution_history.progress',
      table: 'execution_daily',
      writtenDays: 3,
      remainingDays: 5,
      firstMissing: '2026-11-05',
    })
  })

  it('skips a failing day, writes the later ones, and fails the run', async () => {
    const bucket = memoryBucket()
    const table = day('execution_daily')
    bucket.seed(
      'execution_daily',
      sgtDaysBetween(EXECUTION_HISTORY_START, '2026-11-06'),
    )
    vi.mocked(table.fetchDay)
      .mockResolvedValueOnce([])
      .mockRejectedValueOnce(new Error('statement timeout'))
      .mockResolvedValueOnce([])

    await expect(history(bucket, [table])).rejects.toThrow(
      'Execution history failed: execution_daily 2026-11-08',
    )

    expect(
      bucket
        .completed('execution_daily')
        .filter((key) => key >= 'day=2026-11-07'),
    ).toEqual(['day=2026-11-07.v1.json', 'day=2026-11-09.v1.json'])
  })

  it('stops for the night after repeated failures, even mid-day', async () => {
    const bucket = memoryBucket()
    const tables = ['execution_daily', 'execution_step_daily'].map((name) => {
      bucket.seed(name, sgtDaysBetween(EXECUTION_HISTORY_START, '2026-11-01'))
      const table = day(name)
      vi.mocked(table.fetchDay).mockRejectedValue(new Error('reader down'))
      return table
    })

    await expect(history(bucket, tables)).rejects.toThrow(
      'Execution history failed',
    )

    // Two tables fail on the first day, so the cap is reached partway through the second.
    expect(
      tables.reduce(
        (calls, table) => calls + vi.mocked(table.fetchDay).mock.calls.length,
        0,
      ),
    ).toBe(EXECUTION_HISTORY_MAX_FAILURES)
  })

  it('stops between days once the task is asked to stop', async () => {
    const bucket = memoryBucket()
    const table = day('execution_daily')
    bucket.seed(
      'execution_daily',
      sgtDaysBetween(EXECUTION_HISTORY_START, '2026-11-01'),
    )
    const controller = new AbortController()
    vi.mocked(table.fetchDay).mockImplementation(async () => {
      controller.abort()
      return []
    })

    await history(bucket, [table], { signal: controller.signal })

    expect(table.fetchDay).toHaveBeenCalledTimes(1)
  })
})
