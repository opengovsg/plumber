import { beforeEach, describe, expect, it, vi } from 'vitest'

import { countExecutionEnd } from '../execution-end'

const mocks = vi.hoisted(() => ({
  incrementMetric: vi.fn(),
}))

vi.mock('@/helpers/metrics', () => ({
  incrementMetric: mocks.incrementMetric,
}))

const ENDED = { id: 'execution-1', testRun: false }

describe('countExecutionEnd', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it.each([
    { outcome: 'success', tag: 'success' },
    { outcome: 'config', tag: 'config' },
    { outcome: 'third-party', tag: 'third_party' },
    { outcome: 'internal', tag: 'internal' },
  ] as const)('tags a $outcome end as $tag', ({ outcome, tag }) => {
    countExecutionEnd(ENDED, outcome)

    expect(mocks.incrementMetric).toHaveBeenCalledExactlyOnceWith(
      'plumber.executions.ended',
      { outcome: tag },
    )
  })

  it('skips an execution that had already ended', () => {
    countExecutionEnd(undefined, 'success')

    expect(mocks.incrementMetric).not.toHaveBeenCalled()
  })

  it('skips a test run', () => {
    countExecutionEnd({ ...ENDED, testRun: true }, 'success')

    expect(mocks.incrementMetric).not.toHaveBeenCalled()
  })
})
