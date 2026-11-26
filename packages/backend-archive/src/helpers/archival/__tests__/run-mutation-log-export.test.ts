import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('../logger')

import logger from '../logger'
import { runMutationLogExport } from '../run-mutation-log-export'

const never = () => new Promise<void>(() => {})

afterEach(() => {
  vi.clearAllMocks()
})

describe('runMutationLogExport', () => {
  it('logs the duration of a finished export', async () => {
    const ok = await runMutationLogExport({
      run: async () => {},
      deadlineMs: 1_000,
      stop: new AbortController().signal,
    })

    expect(ok).toBe(true)
    expect(logger.info).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'analytics.mutation_log.complete',
        durationMs: expect.any(Number),
        deadlineMs: 1_000,
      }),
    )
  })

  it('returns at the deadline even when the export ignores the signal', async () => {
    const ok = await runMutationLogExport({
      run: never,
      deadlineMs: 20,
      stop: new AbortController().signal,
    })

    expect(ok).toBe(false)
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'analytics.mutation_log.error',
        timedOut: true,
      }),
    )
  })

  it('passes the deadline to the export', async () => {
    let received: AbortSignal | undefined
    await runMutationLogExport({
      run: (signal) => {
        received = signal
        return never()
      },
      deadlineMs: 20,
      stop: new AbortController().signal,
    })

    expect(received?.aborted).toBe(true)
  })

  it('does not report a timeout when the export fails or is stopped', async () => {
    const stopper = new AbortController()
    const failed = runMutationLogExport({
      run: async () => {
        throw new Error('S3 unavailable')
      },
      deadlineMs: 1_000,
      stop: new AbortController().signal,
    })
    const stopped = runMutationLogExport({
      run: never,
      deadlineMs: 1_000,
      stop: stopper.signal,
    })
    stopper.abort()

    expect(await failed).toBe(false)
    expect(await stopped).toBe(false)
    expect(vi.mocked(logger.error).mock.calls).toEqual([
      [expect.objectContaining({ timedOut: false })],
      [expect.objectContaining({ timedOut: false })],
    ])
  })
})
