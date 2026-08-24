import { promisify } from 'node:util'
import { gzip } from 'node:zlib'

import { ListObjectsV2Command, S3Client } from '@aws-sdk/client-s3'
import { describe, expect, it, vi } from 'vitest'

import { S3_PREFIX_EXECUTIONS } from '../build-s3-key'
import { fetchArchivedExecution } from '../fetch-archived-execution'
import type { ArchivedPayload } from '../types'

const gzipAsync = promisify(gzip)

const mockPayload: ArchivedPayload = {
  execution: {
    id: 'exec-1',
    flowId: 'flow-1',
    status: 'success',
    testRun: false,
    internalId: null,
    createdAt: '2025-01-15T00:00:00.000Z',
    updatedAt: '2025-01-15T00:00:00.000Z',
    deletedAt: null,
  },
  steps: [
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
  ],
}

const HIVE_KEY = `${S3_PREFIX_EXECUTIONS}/flow_id=flow-1/year=2025/month=01/execution_id=exec-1.json.gz`

async function makeMockS3(payload: ArchivedPayload): Promise<S3Client> {
  const compressed = await gzipAsync(JSON.stringify(payload))
  return {
    send: vi.fn().mockImplementation((cmd: unknown) => {
      if (cmd instanceof ListObjectsV2Command) {
        return Promise.resolve({
          Contents: [{ Key: HIVE_KEY }],
          NextContinuationToken: undefined,
        })
      }
      // GetObjectCommand
      return Promise.resolve({
        Body: {
          transformToByteArray: vi.fn().mockResolvedValue(compressed),
        },
      })
    }),
  } as unknown as S3Client
}

const baseOpts = { bucket: 'plumber-archive-executions-test' }

describe('fetchArchivedExecution', () => {
  it('fetches, decompresses and parses the S3 payload', async () => {
    const s3 = await makeMockS3(mockPayload)
    const result = await fetchArchivedExecution('flow-1', 'exec-1', {
      ...baseOpts,
      s3Client: s3,
    })
    expect(result.execution.id).toBe('exec-1')
    expect(result.steps).toHaveLength(1)
    expect(result.steps[0].id).toBe('step-1')
  })

  it('calls ListObjectsV2Command with the correct prefix', async () => {
    const s3 = await makeMockS3(mockPayload)
    await fetchArchivedExecution('flow-1', 'exec-1', {
      ...baseOpts,
      s3Client: s3,
    })
    const listCall = (s3.send as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(listCall).toBeInstanceOf(ListObjectsV2Command)
    expect(listCall.input.Prefix).toBe(
      `${S3_PREFIX_EXECUTIONS}/flow_id=flow-1/`,
    )
    expect(listCall.input.Bucket).toBe('plumber-archive-executions-test')
  })

  it('throws when S3 response has no body', async () => {
    const s3 = {
      send: vi.fn().mockImplementation((cmd: unknown) => {
        if (cmd instanceof ListObjectsV2Command) {
          return Promise.resolve({
            Contents: [{ Key: HIVE_KEY }],
            NextContinuationToken: undefined,
          })
        }
        return Promise.resolve({ Body: null })
      }),
    } as unknown as S3Client
    await expect(
      fetchArchivedExecution('flow-1', 'exec-1', { ...baseOpts, s3Client: s3 }),
    ).rejects.toThrow('S3 object has no body')
  })

  it('throws when execution key is not found (404)', async () => {
    const s3 = {
      send: vi.fn().mockImplementation((cmd: unknown) => {
        if (cmd instanceof ListObjectsV2Command) {
          return Promise.resolve({
            Contents: [],
            NextContinuationToken: undefined,
          })
        }
        return Promise.resolve({})
      }),
    } as unknown as S3Client
    await expect(
      fetchArchivedExecution('flow-1', 'exec-1', { ...baseOpts, s3Client: s3 }),
    ).rejects.toThrow(
      'Archived execution not found: flowId=flow-1 executionId=exec-1',
    )
  })
})
