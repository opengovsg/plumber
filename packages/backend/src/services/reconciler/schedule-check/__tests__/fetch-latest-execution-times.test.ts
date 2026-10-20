import '@/config/orm'
import { describe, expect, it } from 'vitest'

import {
  buildLatestExecutionTimesQuery,
  fetchLatestExecutionTimes,
} from '../fetch-latest-execution-times'

const FLOW_A = '0b9f9a8e-5c1e-4c55-9a39-0f6f3f0a1a11'
const FLOW_B = '1c8e8b7d-4b0d-4b44-8a28-1e5e2e1b2b22'

describe('buildLatestExecutionTimesQuery', () => {
  const { sql, bindings } = buildLatestExecutionTimesQuery([FLOW_A, FLOW_B])
    .toKnexQuery()
    .toSQL()

  it('reads the latest non-test execution of each pipe', () => {
    expect(sql).toContain('max("created_at")')
    expect(sql).toContain('"flow_id" in (?, ?)')
    expect(sql).toContain('"test_run" = ?')
    expect(sql).toContain('group by "flow_id"')
    expect(bindings).toEqual([FLOW_A, FLOW_B, false])
  })

  it('includes soft-deleted executions', () => {
    expect(sql).not.toContain('deleted_at')
  })
})

describe('fetchLatestExecutionTimes', () => {
  it('skips the query when no pipe is missing', async () => {
    await expect(fetchLatestExecutionTimes([])).resolves.toEqual(new Map())
  })
})
