import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

import { parquetReadObjects } from 'hyparquet'
import type { Knex } from 'knex'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { localDirSink } from '../export-silver-tables'
import { type SgtDayWindow, sgtDayWindow } from '../sgt-day'
import {
  localDirKeyLister,
  planChangeFiles,
  type SilverChangeTable,
  writeSilverChangeTables,
} from '../silver-change-tables'

vi.mock('../logger')

let dir: string | undefined

afterEach(async () => {
  if (dir) {
    await rm(dir, { recursive: true, force: true })
    dir = undefined
  }
})

describe('planChangeFiles', () => {
  const baseline = { day: '2026-11-08', version: 1, full: true }
  const done = { day: '2026-11-09', version: 1, full: false }

  // No completion file is covered by the writeSilverChangeTables test.
  it.each([
    [
      'a full rewrite',
      [baseline, done],
      true,
      1,
      [{ day: '2026-11-10', full: true }],
    ],
    [
      'a missed night',
      [baseline, done],
      false,
      1,
      [{ day: '2026-11-10', full: false }],
    ],
    [
      'an up-to-date table',
      [baseline, done, { ...done, day: '2026-11-10' }],
      false,
      1,
      [],
    ],
    [
      'a version bump, as a new full copy',
      [baseline, done],
      false,
      2,
      [{ day: '2026-11-10', full: true }],
    ],
    [
      'a finished day from an older version, which is never rewritten',
      [{ ...baseline, version: 2 }, done],
      false,
      2,
      [{ day: '2026-11-10', full: false }],
    ],
  ])('plans %s', (_case, completions, full, version, expected) => {
    expect(
      planChangeFiles(
        { completions, startDay: null },
        '2026-11-10',
        full,
        version,
      ),
    ).toEqual(expected)
  })
})

describe('writeSilverChangeTables', () => {
  it('writes a full first copy, then one file per missed day', async () => {
    dir = await mkdtemp(path.join(tmpdir(), 'change-tables-'))
    const windows: (SgtDayWindow | null)[] = []
    const table: SilverChangeTable<{ id: string }> = {
      name: 'flow_step',
      version: 1,
      columns: { id: 'STRING' },
      async *fetchPages(_db, window) {
        windows.push(window)
        // A full copy spans two pages. A day with no change yields none.
        if (!window) {
          yield [{ id: 'step-1' }]
          yield [{ id: 'step-2' }]
        }
      },
    }
    const written: string[] = []
    const sink = localDirSink(dir)
    const write = (yesterday: string) =>
      writeSilverChangeTables({
        db: {} as Knex,
        sink: (key, body) => {
          written.push(
            key
              .replace('silver/flow_step/', '')
              .replace('bronze/_completion/flow_step/', 'completion '),
          )
          return sink(key, body)
        },
        listKeys: localDirKeyLister(dir!),
        tables: [table],
        yesterday,
      })

    await write('2026-11-08')
    await write('2026-11-10')

    expect(windows).toEqual([
      null,
      sgtDayWindow('2026-11-09'),
      sgtDayWindow('2026-11-10'),
    ])
    // A completion file follows each day's files.
    expect(written).toEqual([
      'completion start=2026-11-08.json',
      'day=2026-11-08.part-1.parquet',
      'day=2026-11-08.parquet',
      'completion day=2026-11-08.v1.full.json',
      'day=2026-11-09.parquet',
      'completion day=2026-11-09.v1.json',
      'day=2026-11-10.parquet',
      'completion day=2026-11-10.v1.json',
    ])
    const file = await readFile(
      path.join(dir, 'silver/flow_step/day=2026-11-08.parquet'),
    )
    expect(
      await parquetReadObjects({
        file: file.buffer.slice(
          file.byteOffset,
          file.byteOffset + file.byteLength,
        ) as ArrayBuffer,
      }),
    ).toEqual([{ day: '2026-11-08', id: 'step-2' }])
  })

  it('redoes a day whose copy failed part-way', async () => {
    dir = await mkdtemp(path.join(tmpdir(), 'change-tables-'))
    let fail = true
    const table: SilverChangeTable<{ id: string }> = {
      name: 'flow_step',
      version: 1,
      columns: { id: 'STRING' },
      async *fetchPages() {
        yield [{ id: 'step-1' }]
        if (fail) {
          throw new Error('connection lost')
        }
        yield [{ id: 'step-2' }]
      },
    }
    const listKeys = localDirKeyLister(dir)
    const write = () =>
      writeSilverChangeTables({
        db: {} as Knex,
        sink: localDirSink(dir!),
        listKeys,
        tables: [table],
        yesterday: '2026-11-08',
      })

    await expect(write()).rejects.toThrow('connection lost')
    expect(await listKeys('bronze/_completion/flow_step/')).toEqual([
      'bronze/_completion/flow_step/start=2026-11-08.json',
    ])

    fail = false
    await write()
    expect((await listKeys('bronze/_completion/flow_step/')).sort()).toEqual([
      'bronze/_completion/flow_step/day=2026-11-08.v1.full.json',
      'bronze/_completion/flow_step/start=2026-11-08.json',
    ])
  })
})
