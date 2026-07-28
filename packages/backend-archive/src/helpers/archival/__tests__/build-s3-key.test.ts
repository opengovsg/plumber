import { Settings as LuxonSettings } from 'luxon'
import { beforeAll, describe, expect, it } from 'vitest'

import {
  buildS3Key,
  S3_PREFIX_EXECUTIONS,
  S3_PREFIX_TEST_EXECUTIONS,
} from '../build-s3-key'

// TZ formatting replicated here (see appConfig) as tests don't load the app
// config module.
beforeAll(() => {
  LuxonSettings.defaultZone = 'Asia/Singapore'
  LuxonSettings.defaultLocale = 'en-SG'
})

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
    // 2025-03-05T00:00Z is 2025-03-05T08:00 SGT — still March
    expect(key).toContain('month=03')
  })

  // pg returns TIMESTAMP columns as Date objects at runtime; verify the same
  // key is produced regardless of whether createdAt is a string or a Date.
  describe('Date object input (pg runtime type)', () => {
    it('produces the same key as an ISO string for a non-test execution', () => {
      const key = buildS3Key({
        flowId: 'flow-abc-123',
        id: 'exec-xyz-789',
        createdAt: new Date('2025-01-15T10:30:00.000Z'),
        testRun: false,
      })
      expect(key).toBe(
        `${S3_PREFIX_EXECUTIONS}/flow_id=flow-abc-123/year=2025/month=01/execution_id=exec-xyz-789.json.gz`,
      )
    })

    it('produces the same key as an ISO string for a test execution', () => {
      const key = buildS3Key({
        flowId: 'flow-abc-123',
        id: 'exec-xyz-789',
        createdAt: new Date('2025-01-15T10:30:00.000Z'),
        testRun: true,
      })
      expect(key).toBe(
        `${S3_PREFIX_TEST_EXECUTIONS}/flow_id=flow-abc-123/year=2025/month=01/execution_id=exec-xyz-789.json.gz`,
      )
    })

    it('applies SGT offset correctly (month rollover) with a Date object', () => {
      // 2025-01-31T16:00:00Z = 2025-02-01T00:00:00+08:00 SGT
      const key = buildS3Key({
        flowId: 'f',
        id: 'e',
        createdAt: new Date('2025-01-31T16:00:00.000Z'),
        testRun: false,
      })
      expect(key).toContain('year=2025')
      expect(key).toContain('month=02')
    })
  })

  describe('SGT month boundary', () => {
    // SGT = UTC+8, so the flip point is 16:00:00 UTC (= 00:00:00 SGT next day)

    it('last second of month in SGT stays in that month', () => {
      // 2025-01-31T15:59:59Z = 2025-01-31T23:59:59+08:00 SGT
      const key = buildS3Key({
        flowId: 'f',
        id: 'e',
        createdAt: '2025-01-31T15:59:59.000Z',
        testRun: false,
      })
      expect(key).toContain('year=2025')
      expect(key).toContain('month=01')
    })

    it('first second of next month in SGT rolls over', () => {
      // 2025-01-31T16:00:00Z = 2025-02-01T00:00:00+08:00 SGT
      const key = buildS3Key({
        flowId: 'f',
        id: 'e',
        createdAt: '2025-01-31T16:00:00.000Z',
        testRun: false,
      })
      expect(key).toContain('year=2025')
      expect(key).toContain('month=02')
    })

    it('last second of year in SGT stays in that year', () => {
      // 2024-12-31T15:59:59Z = 2024-12-31T23:59:59+08:00 SGT
      const key = buildS3Key({
        flowId: 'f',
        id: 'e',
        createdAt: '2024-12-31T15:59:59.000Z',
        testRun: false,
      })
      expect(key).toContain('year=2024')
      expect(key).toContain('month=12')
    })

    it('first second of new year in SGT rolls over', () => {
      // 2024-12-31T16:00:00Z = 2025-01-01T00:00:00+08:00 SGT
      const key = buildS3Key({
        flowId: 'f',
        id: 'e',
        createdAt: '2024-12-31T16:00:00.000Z',
        testRun: false,
      })
      expect(key).toContain('year=2025')
      expect(key).toContain('month=01')
    })
  })
})
