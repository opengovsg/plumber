import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

import type { S3Client } from '@aws-sdk/client-s3'
import { parquetReadObjects } from 'hyparquet'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { localDirSink } from '../../export-silver-tables'
import {
  exportMutationLog,
  previousSgtDay,
  sgtDaysBetween,
  sgtDayWindow,
  writeMutationLogDays,
} from '../export-mutation-log'

vi.mock('@/helpers/archival/logger')

let dir: string | undefined

afterEach(async () => {
  vi.clearAllMocks()
  if (dir) {
    await rm(dir, { recursive: true, force: true })
    dir = undefined
  }
})

describe('Singapore days', () => {
  it('maps a day to its UTC window', () => {
    expect(sgtDayWindow('2026-11-05')).toEqual({
      startMs: Date.parse('2026-11-04T16:00:00.000Z'),
      endMs: Date.parse('2026-11-05T16:00:00.000Z'),
    })
  })

  it('picks the previous Singapore day, not the previous UTC day', () => {
    // 01:30 on 7 Nov in Singapore is still 6 Nov in UTC.
    expect(previousSgtDay(new Date('2026-11-06T17:30:00.000Z'))).toBe(
      '2026-11-06',
    )
  })

  it('lists every day in a range', () => {
    expect(sgtDaysBetween('2026-10-30', '2026-11-02')).toEqual([
      '2026-10-30',
      '2026-10-31',
      '2026-11-01',
      '2026-11-02',
    ])
  })

  it.each([
    ['2026-11-05', '2026-11-04'],
    ['5 Nov', '2026-11-05'],
  ])('rejects the range %s to %s', (from, to) => {
    expect(() => sgtDaysBetween(from, to)).toThrow()
  })
})

describe('writeMutationLogDays', () => {
  it('writes one file per day with the logged mutations', async () => {
    dir = await mkdtemp(path.join(tmpdir(), 'mutation-log-'))
    const fetchDayLines = vi.fn(async () => [
      {
        timestamp: '2026-11-04 16:00:01.000',
        query: 'mutation U($input: X!) { updateFlow(input: $input) { id } }',
        variables: "{'input':{'id':'f1','name':'Private name'}}",
        userId: 'user-1',
        status: '200',
      },
      {
        timestamp: 'garbage',
        query: null,
        variables: null,
        userId: null,
        status: null,
      },
    ])

    await writeMutationLogDays({
      fetchDayLines,
      sink: localDirSink(dir),
      days: ['2026-11-05'],
    })

    expect(fetchDayLines).toHaveBeenCalledWith(sgtDayWindow('2026-11-05'))
    const file = await readFile(
      path.join(dir, 'bronze/mutation_log/day=2026-11-05/current.parquet'),
    )
    const rows = await parquetReadObjects({
      file: file.buffer.slice(
        file.byteOffset,
        file.byteOffset + file.byteLength,
      ) as ArrayBuffer,
    })
    expect(rows).toEqual([
      {
        ts: new Date('2026-11-04T16:00:01.000Z'),
        user_id: 'user-1',
        operation: 'updateFlow',
        flow_id: 'f1',
        step_id: null,
        table_id: null,
        connection_id: null,
        http_status: 200n,
      },
    ])
  })
})

describe('exportMutationLog', () => {
  const logsClient = { send: vi.fn() }
  const s3Client = { send: vi.fn() } as unknown as S3Client

  it.each(['development', 'uat'])(
    'reads nothing when APP_ENV is %s',
    async (appEnv) => {
      await exportMutationLog({
        logsClient,
        s3Client,
        appEnv,
        bucket: 'bucket',
        logGroup: 'server',
        days: ['2026-11-05'],
      })

      expect(logsClient.send).not.toHaveBeenCalled()
    },
  )

  it('fails in prod without a log group', async () => {
    await expect(
      exportMutationLog({
        logsClient,
        s3Client,
        appEnv: 'prod',
        bucket: 'bucket',
        logGroup: undefined,
        days: ['2026-11-05'],
      }),
    ).rejects.toThrow('ANALYTICS_REQUEST_LOG_GROUP')
  })
})
