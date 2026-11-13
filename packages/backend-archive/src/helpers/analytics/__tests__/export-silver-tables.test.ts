import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

import { PutObjectCommand, type S3Client } from '@aws-sdk/client-s3'
import type { Knex } from 'knex'
import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  exportSilverTables,
  localDirSink,
  selectSilverTables,
  writeSilverTables,
} from '../export-silver-tables'
import type { SilverTable } from '../silver-table'

vi.mock('@/helpers/archival/logger')

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
