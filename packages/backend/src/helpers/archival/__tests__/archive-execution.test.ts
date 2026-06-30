import {
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3'
import type { Knex } from 'knex'
import { Settings as LuxonSettings } from 'luxon'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'

import { archiveExecution } from '../archive-execution'
import {
  S3_PREFIX_EXECUTIONS,
  S3_PREFIX_TEST_EXECUTIONS,
} from '../build-s3-key'
import type { ExecutionRow, ExecutionStepRow } from '../types'

vi.mock('./logger')

// TZ formatting replicated here (see appConfig) as tests don't load the app
// config module.
beforeAll(() => {
  LuxonSettings.defaultZone = 'Asia/Singapore'
  LuxonSettings.defaultLocale = 'en-SG'
})

const mockExecution: ExecutionRow = {
  id: 'exec-1',
  flowId: 'flow-1',
  status: 'success',
  testRun: false,
  internalId: null,
  createdAt: '2025-01-15T00:00:00.000Z',
  updatedAt: '2025-01-15T00:00:00.000Z',
  deletedAt: null,
}

const mockSteps: ExecutionStepRow[] = [
  {
    id: 'step-1',
    executionId: 'exec-1',
    stepId: 'step-def-1',
    appKey: 'formsg',
    key: 'trigger',
    jobId: null,
    status: 'success',
    dataIn: { foo: 'bar' },
    dataOut: { result: 'ok' },
    errorDetails: null,
    metadata: {},
    createdAt: '2025-01-15T00:00:01.000Z',
    updatedAt: '2025-01-15T00:00:01.000Z',
    deletedAt: null,
  },
]

function makeMockS3(contentLength = 42) {
  return {
    send: vi.fn().mockImplementation((cmd) => {
      if (cmd instanceof HeadObjectCommand) {
        return Promise.resolve({ ContentLength: contentLength })
      }
      return Promise.resolve({})
    }),
  } as unknown as S3Client
}

function makeMockKnex() {
  const deleteStepsFn = vi.fn().mockResolvedValue(1)
  const deleteExecFn = vi.fn().mockResolvedValue(1)
  const incrementFlowsFn = vi.fn().mockResolvedValue(1)

  function makeTableProxy(table: string) {
    const proxy: Record<string, unknown> = {
      where: vi.fn(() => proxy),
      delete:
        table === 'execution_steps'
          ? deleteStepsFn
          : table === 'executions'
          ? deleteExecFn
          : vi.fn().mockResolvedValue(0),
      increment:
        table === 'flows' ? incrementFlowsFn : vi.fn().mockResolvedValue(0),
    }
    return proxy
  }

  const knexClient = {
    transaction: vi.fn(
      async (cb: (trx: (table: string) => unknown) => Promise<void>) =>
        cb(makeTableProxy),
    ),
    _deleteStepsFn: deleteStepsFn,
    _deleteExecFn: deleteExecFn,
    _incrementFlowsFn: incrementFlowsFn,
  } as unknown as Knex & {
    _deleteStepsFn: ReturnType<typeof vi.fn>
    _deleteExecFn: ReturnType<typeof vi.fn>
    _incrementFlowsFn: ReturnType<typeof vi.fn>
  }
  return knexClient
}

const baseOpts = {
  dryRun: false,
  bucket: 'plumber-archive-test',
  runAt: '2025-01-15T00:00:00.000Z',
}

describe('archiveExecution', () => {
  it('non-test executions use executions/ key prefix', async () => {
    const s3 = makeMockS3()
    const knexClient = makeMockKnex()

    await archiveExecution(mockExecution, mockSteps, {
      ...baseOpts,
      s3Client: s3,
      knexClient,
    })

    const putCall = (s3.send as ReturnType<typeof vi.fn>).mock.calls.find(
      ([cmd]) => cmd instanceof PutObjectCommand,
    )
    expect(putCall[0].input.Bucket).toBe('plumber-archive-test')
    expect(putCall[0].input.Key).toMatch(
      new RegExp(`^${S3_PREFIX_EXECUTIONS}/`),
    )
  })

  it('test-run executions use test-executions/ key prefix', async () => {
    const s3 = makeMockS3()
    const knexClient = makeMockKnex()

    await archiveExecution({ ...mockExecution, testRun: true }, mockSteps, {
      ...baseOpts,
      s3Client: s3,
      knexClient,
    })

    const putCall = (s3.send as ReturnType<typeof vi.fn>).mock.calls.find(
      ([cmd]) => cmd instanceof PutObjectCommand,
    )
    expect(putCall[0].input.Key).toMatch(
      new RegExp(`^${S3_PREFIX_TEST_EXECUTIONS}/`),
    )
  })

  it('returns archived and deletes from DB on success', async () => {
    const s3 = makeMockS3()
    const knexClient = makeMockKnex()

    const result = await archiveExecution(mockExecution, mockSteps, {
      ...baseOpts,
      s3Client: s3,
      knexClient,
    })

    expect(result).toBe('archived')
    expect((knexClient as any)._deleteStepsFn).toHaveBeenCalledOnce()
    expect((knexClient as any)._deleteExecFn).toHaveBeenCalledOnce()
  })

  it('returns archived but skips DB delete when dryRun=true', async () => {
    const s3 = makeMockS3()
    const knexClient = makeMockKnex()

    const result = await archiveExecution(mockExecution, mockSteps, {
      ...baseOpts,
      dryRun: true,
      s3Client: s3,
      knexClient,
    })

    expect(result).toBe('archived')
    expect(knexClient.transaction).not.toHaveBeenCalled()
  })

  it('returns skipped and does not delete when HeadObject ContentLength is 0', async () => {
    const s3 = makeMockS3(0)
    const knexClient = makeMockKnex()

    const result = await archiveExecution(mockExecution, mockSteps, {
      ...baseOpts,
      s3Client: s3,
      knexClient,
    })

    expect(result).toBe('skipped')
    expect(knexClient.transaction).not.toHaveBeenCalled()
  })

  it('returns skipped and does not delete when HeadObject throws', async () => {
    const knexClient = makeMockKnex()
    const s3 = {
      send: vi.fn().mockImplementation((cmd) => {
        if (cmd instanceof HeadObjectCommand) {
          return Promise.reject(new Error('S3 503'))
        }
        return Promise.resolve({})
      }),
    } as unknown as S3Client

    const result = await archiveExecution(mockExecution, mockSteps, {
      ...baseOpts,
      s3Client: s3,
      knexClient,
    })

    expect(result).toBe('skipped')
    expect(knexClient.transaction).not.toHaveBeenCalled()
  })

  describe('archived-at metadata', () => {
    afterEach(() => {
      vi.useRealTimers()
    })

    it('is stamped in SGT (UTC+8), not UTC', async () => {
      // 2025-01-15T00:00:00Z UTC = 2025-01-15T08:00:00+08:00 SGT
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2025-01-15T00:00:00.000Z'))

      const s3 = makeMockS3()
      const knexClient = makeMockKnex()

      await archiveExecution(mockExecution, mockSteps, {
        ...baseOpts,
        s3Client: s3,
        knexClient,
      })

      const putCall = (s3.send as ReturnType<typeof vi.fn>).mock.calls.find(
        ([cmd]) => cmd instanceof PutObjectCommand,
      )
      expect(putCall[0].input.Metadata['archived-at']).toBe(
        '2025-01-15T08:00:00.000+08:00',
      )
    })

    it('correctly crosses midnight — UTC 16:00 is next SGT day', async () => {
      // 2025-01-15T16:00:00Z UTC = 2025-01-16T00:00:00+08:00 SGT
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2025-01-15T16:00:00.000Z'))

      const s3 = makeMockS3()
      const knexClient = makeMockKnex()

      await archiveExecution(mockExecution, mockSteps, {
        ...baseOpts,
        s3Client: s3,
        knexClient,
      })

      const putCall = (s3.send as ReturnType<typeof vi.fn>).mock.calls.find(
        ([cmd]) => cmd instanceof PutObjectCommand,
      )
      expect(putCall[0].input.Metadata['archived-at']).toBe(
        '2025-01-16T00:00:00.000+08:00',
      )
    })
  })

  it('builds the correct S3 key', async () => {
    const s3 = makeMockS3()
    const knexClient = makeMockKnex()

    await archiveExecution(mockExecution, mockSteps, {
      ...baseOpts,
      s3Client: s3,
      knexClient,
    })

    const putCall = (s3.send as ReturnType<typeof vi.fn>).mock.calls.find(
      ([cmd]) => cmd instanceof PutObjectCommand,
    )
    expect(putCall[0].input.Key).toBe(
      `${S3_PREFIX_EXECUTIONS}/flow_id=flow-1/year=2025/month=01/execution_id=exec-1.json.gz`,
    )
  })

  it('increments archived_execution_count for non-test executions', async () => {
    const s3 = makeMockS3()
    const knexClient = makeMockKnex()

    await archiveExecution(mockExecution, mockSteps, {
      ...baseOpts,
      s3Client: s3,
      knexClient,
    })

    expect((knexClient as any)._incrementFlowsFn).toHaveBeenCalledOnce()
  })

  it('does not increment archived_execution_count for test-run executions', async () => {
    const s3 = makeMockS3()
    const knexClient = makeMockKnex()

    await archiveExecution({ ...mockExecution, testRun: true }, mockSteps, {
      ...baseOpts,
      s3Client: s3,
      knexClient,
    })

    expect((knexClient as any)._incrementFlowsFn).not.toHaveBeenCalled()
  })
})
