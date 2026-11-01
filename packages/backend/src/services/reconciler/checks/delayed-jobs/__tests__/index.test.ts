import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { createDelayedJobsCheck } from '..'

const mocks = vi.hoisted(() => ({
  logInfo: vi.fn(),
  logWarn: vi.fn(),
}))

vi.mock('@/helpers/logger', () => ({
  default: { info: mocks.logInfo, warn: mocks.logWarn, error: vi.fn() },
}))

const NOW = Date.UTC(2026, 9, 28, 4, 18, 0)

const QUEUES = [
  { prefix: '{actionQ}', name: 'action' },
  { prefix: 'bull', name: '{app-actions-m365-excel}' },
]

describe('createDelayedJobsCheck', () => {
  const zcount = vi.fn()

  function createCheck(thresholdSeconds = 300) {
    return createDelayedJobsCheck({
      jobsRedis: { zcount },
      queues: QUEUES,
      thresholdSeconds,
    })
  }

  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(NOW)
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.resetAllMocks()
  })

  it('is named delayed-jobs', () => {
    expect(createCheck().name).toBe('delayed-jobs')
  })

  it("counts each queue's delayed set by its own key prefix", async () => {
    zcount.mockResolvedValue(0)

    await createCheck().run()

    expect(zcount.mock.calls.map(([key]) => key)).toEqual([
      '{actionQ}:action:delayed',
      'bull:{app-actions-m365-excel}:delayed',
    ])
  })

  it('counts only jobs due more than the threshold before now', async () => {
    zcount.mockResolvedValue(0)

    await createCheck().run()

    // A job due exactly 300000 ms ago scores at least this bound, so it stays uncounted.
    expect(zcount).toHaveBeenCalledWith(
      '{actionQ}:action:delayed',
      '-inf',
      `(${(NOW - 300_000) * 0x1000}`,
    )
  })

  it('moves the bound with the threshold', async () => {
    zcount.mockResolvedValue(0)

    await createCheck(600).run()

    expect(zcount).toHaveBeenCalledWith(
      '{actionQ}:action:delayed',
      '-inf',
      `(${(NOW - 600_000) * 0x1000}`,
    )
  })

  it('logs one line per queue with its past-due count', async () => {
    zcount.mockResolvedValueOnce(0).mockResolvedValueOnce(3)

    await createCheck().run()

    expect(mocks.logInfo).toHaveBeenCalledTimes(1)
    expect(mocks.logInfo).toHaveBeenCalledWith(expect.any(String), {
      event: 'reconciler-delayed-jobs-check',
      queue: 'action',
      pastDueCount: 0,
    })
    expect(mocks.logWarn).toHaveBeenCalledTimes(1)
    expect(mocks.logWarn).toHaveBeenCalledWith(expect.any(String), {
      event: 'reconciler-delayed-jobs-check',
      queue: '{app-actions-m365-excel}',
      pastDueCount: 3,
    })
  })

  it('rejects and logs no line when one count fails', async () => {
    const error = new Error('Connection is closed.')
    zcount.mockResolvedValueOnce(0).mockRejectedValueOnce(error)

    await expect(createCheck().run()).rejects.toBe(error)

    expect(mocks.logInfo).not.toHaveBeenCalled()
    expect(mocks.logWarn).not.toHaveBeenCalled()
  })
})
