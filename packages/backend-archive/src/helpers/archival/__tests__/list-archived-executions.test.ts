import { ListObjectsV2Command, S3Client } from '@aws-sdk/client-s3'
import { describe, expect, it, vi } from 'vitest'

import { S3_PREFIX_EXECUTIONS } from '../build-s3-key'
import { listArchivedExecutions } from '../list-archived-executions'

const baseOpts = { bucket: 'plumber-archive-executions-test' }

function makeMockS3(pages: Array<{ keys: string[]; hasMore: boolean }>) {
  let pageIdx = 0
  return {
    send: vi.fn().mockImplementation(() => {
      const page = pages[pageIdx++]
      return Promise.resolve({
        Contents: page.keys.map((key) => ({ Key: key })),
        NextContinuationToken: page.hasMore ? `token-${pageIdx}` : undefined,
      })
    }),
  } as unknown as S3Client
}

describe('listArchivedExecutions', () => {
  it('returns execution IDs extracted from S3 keys', async () => {
    const s3 = makeMockS3([
      {
        keys: [
          `${S3_PREFIX_EXECUTIONS}/flow_id=flow-1/year=2025/month=01/execution_id=exec-a.json.gz`,
          `${S3_PREFIX_EXECUTIONS}/flow_id=flow-1/year=2025/month=01/execution_id=exec-b.json.gz`,
        ],
        hasMore: false,
      },
    ])
    const ids = await listArchivedExecutions('flow-1', {
      ...baseOpts,
      s3Client: s3,
    })
    expect(ids).toEqual(['exec-a', 'exec-b'])
  })

  it('uses the correct prefix and bucket', async () => {
    const s3 = makeMockS3([{ keys: [], hasMore: false }])
    await listArchivedExecutions('flow-1', {
      ...baseOpts,
      s3Client: s3,
    })
    const cmd = (s3.send as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(cmd).toBeInstanceOf(ListObjectsV2Command)
    expect(cmd.input.Prefix).toBe(`${S3_PREFIX_EXECUTIONS}/flow_id=flow-1/`)
    expect(cmd.input.Bucket).toBe('plumber-archive-executions-test')
  })

  it('paginates until NextContinuationToken is absent', async () => {
    const s3 = makeMockS3([
      {
        keys: [
          `${S3_PREFIX_EXECUTIONS}/flow_id=flow-1/year=2025/month=01/execution_id=exec-a.json.gz`,
        ],
        hasMore: true,
      },
      {
        keys: [
          `${S3_PREFIX_EXECUTIONS}/flow_id=flow-1/year=2025/month=01/execution_id=exec-b.json.gz`,
        ],
        hasMore: false,
      },
    ])
    const ids = await listArchivedExecutions('flow-1', {
      ...baseOpts,
      s3Client: s3,
    })
    expect(ids).toEqual(['exec-a', 'exec-b'])
    expect((s3.send as ReturnType<typeof vi.fn>).mock.calls).toHaveLength(2)
  })

  it('returns empty array when no objects exist', async () => {
    const s3 = makeMockS3([{ keys: [], hasMore: false }])
    const ids = await listArchivedExecutions('flow-1', {
      ...baseOpts,
      s3Client: s3,
    })
    expect(ids).toEqual([])
  })
})
