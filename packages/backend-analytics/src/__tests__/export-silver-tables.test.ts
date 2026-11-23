import { chmod, mkdtemp, readdir, readFile, rm, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

import { PutObjectCommand, type S3Client } from '@aws-sdk/client-s3'
import type { Knex } from 'knex'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { localDirCompletionStore } from '../completion-stores'
import {
  exportSilverTables,
  localDirSink,
  selectSilverTables,
  writeAllSilverTables,
  writeSilverTables,
} from '../export-silver-tables'
import logger from '../logger'
import type { SilverChangeTable } from '../silver-change-tables'
import type { SilverTable } from '../silver-table'

vi.mock('../logger')

type TestRow = { id: string; created_at: Date }

const testTable: SilverTable<TestRow> = {
  name: 'test_table',
  columns: { id: 'STRING', created_at: 'TIMESTAMP' },
  fetchRows: vi.fn(async () => [
    { id: 'row-1', created_at: new Date('2026-10-01T00:00:00.000Z') },
  ]),
}

function makeS3() {
  return { send: vi.fn().mockResolvedValue({}) }
}

const db = {} as Knex

afterEach(() => {
  vi.clearAllMocks()
})

describe('exportSilverTables', () => {
  it.each(['development', 'uat'])(
    'writes nothing when APP_ENV is %s',
    async (appEnv) => {
      const s3 = makeS3()

      await exportSilverTables({
        db,
        s3Client: s3 as unknown as S3Client,
        appEnv,
        bucket: 'analytics-bucket',
        tables: [testTable],
        changeTables: [],
      })

      expect(testTable.fetchRows).not.toHaveBeenCalled()
      expect(s3.send).not.toHaveBeenCalled()
    },
  )

  it.each(['prod', 'staging'])(
    'writes one Parquet file per table in %s',
    async (appEnv) => {
      const s3 = makeS3()

      await exportSilverTables({
        db,
        s3Client: s3 as unknown as S3Client,
        appEnv,
        bucket: 'analytics-bucket',
        tables: [testTable],
        changeTables: [],
      })

      expect(s3.send).toHaveBeenCalledTimes(1)
      const command = s3.send.mock.calls[0][0]
      expect(command).toBeInstanceOf(PutObjectCommand)
      expect(command.input).toMatchObject({
        Bucket: 'analytics-bucket',
        Key: 'silver/test_table/current.parquet',
        ContentType: 'application/vnd.apache.parquet',
      })
    },
  )

  it('fails in prod when the bucket is not configured', async () => {
    const s3 = makeS3()

    await expect(
      exportSilverTables({
        db,
        s3Client: s3 as unknown as S3Client,
        appEnv: 'prod',
        bucket: undefined,
        tables: [testTable],
        changeTables: [],
      }),
    ).rejects.toThrow('ANALYTICS_BUCKET must be set in prod')
    expect(s3.send).not.toHaveBeenCalled()
  })
})

describe('writeSilverTables to a local folder', () => {
  it('writes each table at the same key the nightly job uses', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'silver-'))
    try {
      await writeSilverTables({
        db,
        tables: [testTable],
        sink: localDirSink(dir),
      })

      const body = await readFile(
        path.join(dir, 'silver/test_table/current.parquet'),
      )
      expect(body.subarray(0, 4).toString()).toBe('PAR1')
      expect(await readdir(path.join(dir, 'silver/test_table'))).toEqual([
        'current.parquet',
      ])
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })

  it('keeps the files readable only by the invoking user', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'silver-'))
    const tableDir = path.join(dir, 'silver/test_table')
    const filePath = path.join(tableDir, 'current.parquet')
    const mode = async (p: string) => (await stat(p)).mode & 0o777
    const write = () =>
      writeSilverTables({ db, tables: [testTable], sink: localDirSink(dir) })
    try {
      await write()
      expect(await mode(tableDir)).toBe(0o700)
      expect(await mode(filePath)).toBe(0o600)

      await chmod(filePath, 0o644)
      await write()
      expect(await mode(filePath)).toBe(0o600)
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })
})

describe('writeAllSilverTables', () => {
  it('writes every other table after one fails, then fails the run', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'silver-'))
    const failing: SilverTable<TestRow> = {
      ...testTable,
      name: 'dim_user',
      fetchRows: vi.fn(async () => {
        throw new Error('query failed')
      }),
    }
    const changeTable: SilverChangeTable<{ id: string }> = {
      name: 'flow_step',
      version: 1,
      columns: { id: 'STRING' },
      async *fetchPages() {
        yield [{ id: 'step-1' }]
      },
    }
    try {
      await expect(
        writeAllSilverTables({
          db,
          sink: localDirSink(dir),
          store: localDirCompletionStore(dir),
          tables: [failing, testTable],
          changeTables: [changeTable],
        }),
      ).rejects.toThrow('Analytics tables failed: dim_user')

      expect((await readdir(path.join(dir, 'silver'))).sort()).toEqual([
        'flow_step',
        'test_table',
      ])
      expect(logger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          event: 'analytics.export.table.error',
          table: 'dim_user',
        }),
      )
      expect(logger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          event: 'analytics.export.coverage',
          job: 'flow_step',
        }),
      )
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })
})

describe('localDirSink', () => {
  it('publishes one complete file when two writers share a key', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'silver-'))
    try {
      const sink = localDirSink(dir)
      const first = Buffer.alloc(4_000_000, 'a')
      const second = Buffer.alloc(4_000_000, 'b')
      await Promise.all([
        sink('k/day.parquet', first),
        sink('k/day.parquet', second),
      ])

      const body = await readFile(path.join(dir, 'k/day.parquet'))
      expect([first, second].some((written) => written.equals(body))).toBe(true)
      expect(await readdir(path.join(dir, 'k'))).toEqual(['day.parquet'])
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })
})

describe('selectSilverTables', () => {
  it('splits the named tables into rebuilt and change tables', () => {
    const { tables, changeTables } = selectSilverTables([
      'flow_step',
      'dim_user',
      'flow_transfer',
    ])

    expect(tables.map((t) => t.name)).toEqual(['flow_transfer', 'dim_user'])
    expect(changeTables.map((t) => t.name)).toEqual(['flow_step'])
  })

  it('rejects an unknown table name', () => {
    expect(() => selectSilverTables(['dim_users'])).toThrow(
      'Unknown silver tables: dim_users',
    )
  })
})
