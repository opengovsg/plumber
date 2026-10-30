import { afterEach, describe, expect, it, vi } from 'vitest'

import { type ReconcilerCheck, runChecksOnce } from '../run-checks'

const mocks = vi.hoisted(() => ({
  logError: vi.fn(),
}))

vi.mock('@/helpers/logger', () => ({
  default: {
    error: mocks.logError,
    warn: vi.fn(),
    info: vi.fn(),
  },
}))

function makeCheck(
  name: string,
  run: () => Promise<void> = async () => undefined,
): ReconcilerCheck & { run: ReturnType<typeof vi.fn> } {
  return { name, run: vi.fn(run) }
}

describe('runChecksOnce', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('runs every check once and returns true when all succeed', async () => {
    const first = makeCheck('first')
    const second = makeCheck('second')

    await expect(runChecksOnce({ checks: [first, second] })).resolves.toBe(true)

    expect(first.run).toHaveBeenCalledTimes(1)
    expect(second.run).toHaveBeenCalledTimes(1)
    expect(mocks.logError).not.toHaveBeenCalled()
  })

  it('returns true when there are no checks', async () => {
    await expect(runChecksOnce({ checks: [] })).resolves.toBe(true)
  })

  it('runs the other checks and returns false when a check rejects', async () => {
    const error = new Error('boom')
    const failing = makeCheck('failing', async () => {
      throw error
    })
    const other = makeCheck('other')

    await expect(runChecksOnce({ checks: [failing, other] })).resolves.toBe(
      false,
    )

    expect(other.run).toHaveBeenCalledTimes(1)
    expect(mocks.logError).toHaveBeenCalledWith(
      'Reconciler check failed',
      expect.objectContaining({
        event: 'reconciler-check-failed',
        checkName: 'failing',
        error,
      }),
    )
  })

  it('runs the other checks when a check throws synchronously', async () => {
    const throwing: ReconcilerCheck = {
      name: 'throwing',
      run: () => {
        throw new Error('sync boom')
      },
    }
    const other = makeCheck('other')

    await expect(runChecksOnce({ checks: [throwing, other] })).resolves.toBe(
      false,
    )

    expect(other.run).toHaveBeenCalledTimes(1)
    expect(mocks.logError).toHaveBeenCalledWith(
      'Reconciler check failed',
      expect.objectContaining({ checkName: 'throwing' }),
    )
  })

  it('does not delay the other checks while a check hangs', async () => {
    let otherFinished = false
    const hung = makeCheck('hung', () => new Promise<void>(() => undefined))
    const other = makeCheck('other', async () => {
      otherFinished = true
    })

    let settled = false
    void runChecksOnce({ checks: [hung, other] }).then(() => {
      settled = true
    })

    await vi.waitFor(() => expect(otherFinished).toBe(true))
    expect(settled).toBe(false)
  })
})
