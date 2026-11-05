import '@/config/orm'
import { describe, expect, it } from 'vitest'

import {
  buildLatestExecutionTimesQuery,
  fetchLatestExecutionTimes,
} from '../fetch-latest-execution-times'

const FLOW_A = '0b9f9a8e-5c1e-4c55-9a39-0f6f3f0a1a11'
const FLOW_B = '1c8e8b7d-4b0d-4b44-8a28-1e5e2e1b2b22'
const SINCE_MILLIS = Date.UTC(2026, 9, 25)

describe('buildLatestExecutionTimesQuery', () => {
  const { sql, bindings } = buildLatestExecutionTimesQuery(
    [FLOW_A, FLOW_B],
    SINCE_MILLIS,
  )
    .toKnexQuery()
    .toSQL()

  it('reads the latest non-test execution of each pipe', () => {
    expect(sql).toContain('max("created_at")')
    expect(sql).toContain('"flow_id" in (?, ?)')
    expect(sql).toContain('"test_run" = ?')
    expect(sql).toContain('group by "flow_id"')
    expect(bindings).toEqual([FLOW_A, FLOW_B, false, new Date(SINCE_MILLIS)])
  })

  it('reads only executions inside the look-back window', () => {
    expect(sql).toContain('"created_at" >= ?')
  })

  it('includes soft-deleted executions', () => {
    expect(sql).not.toContain('deleted_at')
  })
})

describe('fetchLatestExecutionTimes', () => {
  it('skips the query when no pipe is missing', async () => {
    await expect(fetchLatestExecutionTimes([], SINCE_MILLIS)).resolves.toEqual(
      new Map(),
    )
  })
})
