import {
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3'
import type { Knex } from 'knex'
import { describe, expect, it, vi } from 'vitest'

import { archiveExecution } from './archive-execution'
import type { ExecutionRow, ExecutionStepRow } from './types'

vi.mock('./logger')

const mockExecution: ExecutionRow = {
  id: 'exec-1',
  flowId: 'flow-1',
  status: 'success',
  testRun: false,
  internalId: null,
  createdAt: new Date('2025-01-15T00:00:00.000Z'),
  updatedAt: new Date('2025-01-15T00:00:00.000Z'),
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
    createdAt: new Date('2025-01-15T00:00:01.000Z'),
    updatedAt: new Date('2025-01-15T00:00:01.000Z'),
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
  const trx = (table: string) => ({
    where: () => ({
      delete: table === 'execution_steps' ? deleteStepsFn : deleteExecFn,
    }),
  })
  const knexClient = {
    transaction: vi.fn(async (cb: (trx: unknown) => Promise<void>) => cb(trx)),
    _deleteStepsFn: deleteStepsFn,
    _deleteExecFn: deleteExecFn,
  } as unknown as Knex & {
    _deleteStepsFn: ReturnType<typeof vi.fn>
    _deleteExecFn: ReturnType<typeof vi.fn>
  }
  return knexClient
}

const baseOpts = {
  dryRun: false,
  execsBucket: 'plumber-archive-executions-test',
  testExecsBucket: 'plumber-archive-test-executions-test',
}

describe('archiveExecution', () => {
  it('uploads to prod bucket for non-test-run executions', async () => {
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
    expect(putCall[0].input.Bucket).toBe('plumber-archive-executions-test')
  })

  it('uploads to test bucket for test-run executions', async () => {
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
    expect(putCall[0].input.Bucket).toBe('plumber-archive-test-executions-test')
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
      'archives/executions/flow_id=flow-1/year=2025/month=01/execution_id=exec-1.json.gz',
    )
  })
})
