import { describe, expect, it } from 'vitest'

import { buildS3Key } from './build-s3-key'

describe('buildS3Key', () => {
  it('builds the correct Hive-partitioned key', () => {
    const key = buildS3Key({
      flowId: 'flow-abc-123',
      id: 'exec-xyz-789',
      createdAt: new Date('2025-01-15T10:30:00.000Z'),
    })
    expect(key).toBe(
      'flow_id=flow-abc-123/year=2025/month=01/execution_id=exec-xyz-789.json.gz',
    )
  })

  it('zero-pads single-digit months', () => {
    const key = buildS3Key({
      flowId: 'f',
      id: 'e',
      createdAt: new Date('2025-03-05T00:00:00.000Z'),
    })
    expect(key).toContain('month=03')
  })

  it('accepts a date string for createdAt', () => {
    const key = buildS3Key({
      flowId: 'f',
      id: 'e',
      createdAt: '2025-11-20T00:00:00.000Z',
    })
    expect(key).toContain('month=11')
    expect(key).toContain('year=2025')
  })
})
