import { mkdtemp, readdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

import type { Knex } from 'knex'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { localDirCompletionStore } from '../completion-stores'
import { readJobState } from '../day-completion'
import {
  EXECUTION_HISTORY_START,
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
    })

    expect(
      vi.mocked(table.fetchDay).mock.calls.map(([, query]) => query.window),
    ).toEqual([sgtDayWindow('2026-11-10'), sgtDayWindow('2026-11-11')])
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

// Holds completion files in memory, since the floor reads one per day back to 2023.
function memoryBucket() {
  const keys = new Set<string>()
  const store = {
    list: async (prefix: string) =>
      [...keys]
        .filter((key) => key.startsWith(prefix))
        .map((key) => ({ key, lastModified: NOW })),
    read: async () => null,
    lastModified: async () => null,
  }
  const seed = (job: string, days: string[]) => {
    for (const day of days) {
      keys.add(`bronze/_completion/${job}/day=${day}.v1.json`)
    }
  }
  return { store, seed }
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
