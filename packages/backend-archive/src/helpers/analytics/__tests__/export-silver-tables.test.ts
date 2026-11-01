import { PutObjectCommand, type S3Client } from '@aws-sdk/client-s3'
import type { Knex } from 'knex'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { exportSilverTables } from '../export-silver-tables'
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
  it.each(['development', 'staging', 'uat'])(
    'writes nothing when APP_ENV is %s',
    async (appEnv) => {
      const s3 = makeS3()

      await exportSilverTables({
        db,
        s3Client: s3 as unknown as S3Client,
        appEnv,
        bucket: 'analytics-bucket',
        tables: [testTable],
      })

      expect(testTable.fetchRows).not.toHaveBeenCalled()
      expect(s3.send).not.toHaveBeenCalled()
    },
  )

  it('writes one Parquet file per table in prod', async () => {
    const s3 = makeS3()

    await exportSilverTables({
      db,
      s3Client: s3 as unknown as S3Client,
      appEnv: 'prod',
      bucket: 'analytics-bucket',
      tables: [testTable],
    })

    expect(s3.send).toHaveBeenCalledTimes(1)
    const command = s3.send.mock.calls[0][0]
    expect(command).toBeInstanceOf(PutObjectCommand)
    expect(command.input).toMatchObject({
      Bucket: 'analytics-bucket',
      Key: 'silver/test_table/current.parquet',
      ContentType: 'application/vnd.apache.parquet',
    })
  })

  it('fails in prod when the bucket is not configured', async () => {
    const s3 = makeS3()

    await expect(
      exportSilverTables({
        db,
        s3Client: s3 as unknown as S3Client,
        appEnv: 'prod',
        bucket: undefined,
        tables: [testTable],
      }),
    ).rejects.toThrow('ANALYTICS_BUCKET must be set in prod')
    expect(s3.send).not.toHaveBeenCalled()
  })
})
