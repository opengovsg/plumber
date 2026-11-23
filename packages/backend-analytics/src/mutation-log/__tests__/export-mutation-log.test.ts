import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

import type { S3Client } from '@aws-sdk/client-s3'
import { parquetMetadata, parquetReadObjects } from 'hyparquet'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { localDirCompletionStore } from '../../completion-stores'
import { loadJobState, readJobState } from '../../day-completion'
import { localDirSink } from '../../export-silver-tables'
import {
  exportMutationLog,
  exportMutationLogToDir,
  MUTATION_LOG_ROW_GROUP_SIZE,
  MUTATION_LOG_TABLE,
  sortForFlowSearch,
  writeMutationLogDays,
} from '../export-mutation-log'
import type { MutationLogRow } from '../parse-mutation-line'

vi.mock('../../logger')

let dir: string | undefined

afterEach(async () => {
  vi.clearAllMocks()
  if (dir) {
    await rm(dir, { recursive: true, force: true })
    dir = undefined
  }
})

const noFlows = async () => new Map<string, string>()
const state = readJobState([])

describe('writeMutationLogDays', () => {
  it("fills a deleted step's pipe from its step id", async () => {
    dir = await mkdtemp(path.join(tmpdir(), 'mutation-log-'))
    const STEP = 'aaaaaaaa-0000-4000-8000-000000000001'
    const resolveFlowIds = vi.fn(async () => new Map([[STEP, 'f1']]))

    await writeMutationLogDays({
      // The editor's DeleteStepButton payload, which has no pipe id.
      fetchDayLines: async () => [
        {
          timestamp: '2026-11-04 16:00:01.000',
          query:
            'mutation DeleteStep($input: DeleteStepInput!) { deleteStep(input: $input) { id } }',
          variables: `{'input':{'ids':['${STEP.toUpperCase()}'],'flow':{'updatedAt':'2026-11-04T15:59:00.000Z'}}}`,
          userId: 'user-1',
          status: '200',
        },
      ],
      resolveFlowIds,
      sink: localDirSink(dir),
      days: ['2026-11-05'],
      state,
    })

    // An uppercase id is looked up in Postgres's lowercase form and logged as sent.
    expect(resolveFlowIds).toHaveBeenCalledWith([STEP])
    const file = await readFile(
      path.join(dir, 'bronze/mutation_log/day=2026-11-05/current.parquet'),
    )
    expect(await parquetReadObjects({ file: toArrayBuffer(file) })).toEqual([
      expect.objectContaining({
        operation: 'deleteStep',
        step_id: STEP.toUpperCase(),
        flow_id: 'f1',
      }),
    ])
  })

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
      resolveFlowIds: noFlows,
      sink: localDirSink(dir),
      days: ['2026-11-05'],
      state,
    })

    expect(fetchDayLines).toHaveBeenCalledWith({
      startMs: Date.parse('2026-11-04T16:00:00.000Z'),
      endMs: Date.parse('2026-11-05T16:00:00.000Z'),
    })
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
        app_key: null,
        action_key: null,
        resource_id: null,
        http_status: 200n,
      },
    ])
  })

  it('marks a day done only after its file is written', async () => {
    const written: string[] = []
    const write = (fail: boolean) =>
      writeMutationLogDays({
        fetchDayLines: async () => [],
        resolveFlowIds: noFlows,
        sink: async (key) => {
          if (fail && key.startsWith('bronze/mutation_log/')) {
            throw new Error('upload failed')
          }
          written.push(key)
        },
        days: ['2026-11-05'],
        state,
        source: 'nightly',
      })

    await expect(write(true)).rejects.toThrow(
      'mutation_log: 1 day(s) failed: 2026-11-05',
    )
    expect(written).toEqual([])

    await write(false)
    expect(written).toEqual([
      'bronze/mutation_log/day=2026-11-05/current.parquet',
      'bronze/_completion/mutation_log/day=2026-11-05.v1.json',
    ])
  })
})

function toArrayBuffer(file: Buffer): ArrayBuffer {
  return file.buffer.slice(
    file.byteOffset,
    file.byteOffset + file.byteLength,
  ) as ArrayBuffer
}

function row(flowId: string | null, ms: number): MutationLogRow {
  return {
    ts: new Date(ms),
    user_id: null,
    operation: 'updateFlow',
    flow_id: flowId,
    step_id: null,
    table_id: null,
    connection_id: null,
    app_key: null,
    action_key: null,
    resource_id: null,
    http_status: 200,
  }
}

describe('sortForFlowSearch', () => {
  it('orders by flow_id, then time, with rows without a pipe last', () => {
    const rows = [row(null, 1), row('b', 2), row('a', 3), row('a', 1)]

    expect(
      sortForFlowSearch(rows).map((r) => [r.flow_id, r.ts.getTime()]),
    ).toEqual([
      ['a', 1],
      ['a', 3],
      ['b', 2],
      [null, 1],
    ])
  })
})

describe('the mutation log file layout', () => {
  it('writes sorted row groups with flow_id statistics and a bloom filter', async () => {
    dir = await mkdtemp(path.join(tmpdir(), 'mutation-log-'))
    const lineCount = MUTATION_LOG_ROW_GROUP_SIZE * 2 + 500
    const lines = Array.from({ length: lineCount }, (_, i) => ({
      timestamp: '2026-11-04 16:00:01.000',
      query: 'mutation U($input: X!) { updateFlow(input: $input) { id } }',
      // Unsorted on purpose: the writer must sort.
      variables: `{'input':{'id':'flow-${String((i * 7919) % lineCount).padStart(5, '0')}'}}`,
      userId: 'user-1',
      status: '200',
    }))

    await writeMutationLogDays({
      fetchDayLines: async () => lines,
      resolveFlowIds: noFlows,
      sink: localDirSink(dir),
      days: ['2026-11-05'],
      state,
    })

    const file = await readFile(
      path.join(dir, 'bronze/mutation_log/day=2026-11-05/current.parquet'),
    )
    const metadata = parquetMetadata(toArrayBuffer(file))
    const flowColumn = metadata.schema
      .slice(1)
      .findIndex((element) => element.name === 'flow_id')
    const groups = metadata.row_groups.map(
      (group) => group.columns[flowColumn].meta_data,
    )

    expect(metadata.row_groups).toHaveLength(3)
    expect(
      groups.every((meta) => meta?.bloom_filter_offset !== undefined),
    ).toBe(true)
    const ranges = groups.map((meta) => [
      String(meta?.statistics?.min_value),
      String(meta?.statistics?.max_value),
    ])
    for (let i = 1; i < ranges.length; i++) {
      expect(ranges[i - 1][1] < ranges[i][0]).toBe(true)
    }
  })
})

describe('exportMutationLog', () => {
  const logsClient = { send: vi.fn() }
  const s3Client = { send: vi.fn() } as unknown as S3Client

  it.each(['development', 'uat'])(
    'reads nothing when APP_ENV is %s',
    async (appEnv) => {
      await exportMutationLog({
        db: {} as never,
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
        db: {} as never,
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

describe('exportMutationLogToDir', () => {
  it('marks each written day complete in the folder', async () => {
    dir = await mkdtemp(path.join(tmpdir(), 'mutation-log-'))

    await exportMutationLogToDir({
      dir,
      fetchDayLines: async () => [],
      resolveFlowIds: noFlows,
      days: ['2026-11-04', '2026-11-05'],
    })

    const { completions, startDay } = await loadJobState(
      localDirCompletionStore(dir),
      MUTATION_LOG_TABLE,
      '2026-11-05',
    )
    expect(startDay).toBe('2026-11-04')
    expect(completions.map(({ day }) => day).sort()).toEqual([
      '2026-11-04',
      '2026-11-05',
    ])
  })
})
