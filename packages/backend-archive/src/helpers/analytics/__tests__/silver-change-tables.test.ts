import { mkdtemp, readdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

import type { Knex } from 'knex'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { localDirSink } from '../export-silver-tables'
import {
  previousSgtDay,
  type SgtDayWindow,
  sgtDaysAfter,
  sgtDayWindow,
} from '../sgt-day'
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

describe('Singapore days', () => {
  it('maps a day to its UTC window', () => {
    expect(sgtDayWindow('2026-11-05')).toEqual({
      start: new Date('2026-11-04T16:00:00.000Z'),
      end: new Date('2026-11-05T16:00:00.000Z'),
    })
  })

  it('takes yesterday in Singapore, not in UTC', () => {
    // 01:30 on 7 Nov in Singapore is still 6 Nov in UTC.
    expect(previousSgtDay(new Date('2026-11-06T17:30:00.000Z'))).toBe(
      '2026-11-06',
    )
  })

  it('lists the days after one day through another', () => {
    expect(sgtDaysAfter('2026-10-30', '2026-11-02')).toEqual([
      '2026-10-31',
      '2026-11-01',
      '2026-11-02',
    ])
    expect(sgtDaysAfter('2026-11-02', '2026-11-02')).toEqual([])
  })
})

describe('planChangeFiles', () => {
  const key = (day: string) => `silver/flow_step/day=${day}.parquet`

  it.each([
    ['no file yet', [], false, [{ day: '2026-11-10', full: true }]],
    [
      'a full rewrite',
      [key('2026-11-10')],
      true,
      [{ day: '2026-11-10', full: true }],
    ],
    [
      'missed nights',
      [key('2026-11-07'), key('2026-11-08')],
      false,
      [
        { day: '2026-11-09', full: false },
        { day: '2026-11-10', full: false },
      ],
    ],
    ['an up-to-date folder', [key('2026-11-10')], false, []],
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
    const write = (yesterday: string) =>
      writeSilverChangeTables({
        db: {} as Knex,
        sink: localDirSink(dir!),
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
    expect((await readdir(path.join(dir, 'silver/flow_step'))).sort()).toEqual([
      'day=2026-11-08.parquet',
      'day=2026-11-08.part-2.parquet',
      'day=2026-11-09.parquet',
      'day=2026-11-10.parquet',
    ])
  })
})
