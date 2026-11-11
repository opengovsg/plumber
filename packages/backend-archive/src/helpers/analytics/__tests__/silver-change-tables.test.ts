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

vi.mock('@/helpers/archival/logger')

let dir: string | undefined

afterEach(async () => {
  if (dir) {
    await rm(dir, { recursive: true, force: true })
    dir = undefined
  }
})

describe('planChangeFiles', () => {
  const key = (day: string) => `silver/flow_step/day=${day}.parquet`

  // An empty folder and missed nights are covered by the writeSilverChangeTables test.
  it.each([
    [
      'a full rewrite',
      [key('2026-11-10')],
      true,
      [{ day: '2026-11-10', full: true }],
    ],
    ['an up-to-date folder', [key('2026-11-10')], false, []],
    [
      'a copy that failed part-way',
      ['silver/flow_step/day=2026-11-10.part-1.parquet'],
      false,
      [{ day: '2026-11-10', full: true }],
    ],
  ])('plans %s', (_case, keys, full, expected) => {
    expect(planChangeFiles(keys, '2026-11-10', full)).toEqual(expected)
  })
})

describe('writeSilverChangeTables', () => {
  it('writes a full first copy, then one file per missed day', async () => {
    dir = await mkdtemp(path.join(tmpdir(), 'change-tables-'))
    const windows: (SgtDayWindow | null)[] = []
    const table: SilverChangeTable<{ id: string }> = {
      name: 'flow_step',
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
          written.push(key.replace('silver/flow_step/', ''))
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
    // The unnumbered key marks a day done, so it is written after the parts.
    expect(written).toEqual([
      'day=2026-11-08.part-1.parquet',
      'day=2026-11-08.parquet',
      'day=2026-11-09.parquet',
      'day=2026-11-10.parquet',
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
})
