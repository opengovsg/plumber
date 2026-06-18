import { describe, expect, it } from 'vitest'

import {
  buildS3Key,
  S3_PREFIX_EXECUTIONS,
  S3_PREFIX_TEST_EXECUTIONS,
} from './build-s3-key'

describe('buildS3Key', () => {
  it('builds the correct key for non-test executions', () => {
    const key = buildS3Key({
      flowId: 'flow-abc-123',
      id: 'exec-xyz-789',
      createdAt: '2025-01-15T10:30:00.000Z',
      testRun: false,
    })
    expect(key).toBe(
      `${S3_PREFIX_EXECUTIONS}/flow_id=flow-abc-123/year=2025/month=01/execution_id=exec-xyz-789.json.gz`,
    )
  })

  it('uses test-executions prefix for test runs', () => {
    const key = buildS3Key({
      flowId: 'flow-abc-123',
      id: 'exec-xyz-789',
      createdAt: '2025-01-15T10:30:00.000Z',
      testRun: true,
    })
    expect(key).toBe(
      `${S3_PREFIX_TEST_EXECUTIONS}/flow_id=flow-abc-123/year=2025/month=01/execution_id=exec-xyz-789.json.gz`,
    )
  })

  it('zero-pads single-digit months', () => {
    const key = buildS3Key({
      flowId: 'f',
      id: 'e',
      createdAt: '2025-03-05T00:00:00.000Z',
      testRun: false,
    })
    expect(key).toContain('month=03')
  })
})
