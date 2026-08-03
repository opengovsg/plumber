import type { IActionJobData } from '@plumber/types'

import { type JobPro } from '@taskforcesh/bullmq-pro'
import { afterEach, describe, expect, it, vi } from 'vitest'

import RetriableError, { DEFAULT_DELAY_MS } from '@/errors/retriable-error'

import { exponentialBackoffWithJitter } from '../backoff'

const mocks = vi.hoisted(() => ({
  logError: vi.fn(),
}))

vi.mock('@/helpers/logger', () => ({
  default: {
    error: mocks.logError,
    info: vi.fn(),
  },
}))

describe('Backoff', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it.each([
    {
      delayInMs: 'default' as const,
      expectedBaseDelay: DEFAULT_DELAY_MS,
    },
    { delayInMs: 5000, expectedBaseDelay: 5000 },
    { delayInMs: 1, expectedBaseDelay: 1 },
  ])(
    'applies jitter (delayInMs = $delayInMs)',
    async ({ delayInMs, expectedBaseDelay }) => {
      const err = new RetriableError({
        error: 'test error',
        delayInMs,
        delayType: 'step',
      })
      vi.spyOn(Math, 'random').mockReturnValue(0.5)

      await expect(exponentialBackoffWithJitter(1, null, err)).resolves.toEqual(
        Math.round(expectedBaseDelay + expectedBaseDelay / 2),
      )
      await expect(exponentialBackoffWithJitter(2, null, err)).resolves.toEqual(
        Math.round(
          expectedBaseDelay * 2 /* Full delay for 1st retry */ +
            expectedBaseDelay /* 50% of full delay*/,
        ),
      )
      await expect(exponentialBackoffWithJitter(3, null, err)).resolves.toEqual(
        Math.round(
          expectedBaseDelay * 4 /* Full delay for 2nd retry */ +
            expectedBaseDelay * 2 /* 50% of full delay*/,
        ),
      )
    },
  )

  it.each([
    {
      delayInMs: 'default' as const,
      expectedBaseDelay: DEFAULT_DELAY_MS,
    },
    { delayInMs: 5000, expectedBaseDelay: 5000 },
    { delayInMs: 1, expectedBaseDelay: 1 },
  ])(
    'will wait at least the full duration of the previous default delay',
    async ({ delayInMs, expectedBaseDelay }) => {
      const err = new RetriableError({
        error: 'test error',
        delayInMs,
        delayType: 'step',
      })
      vi.spyOn(Math, 'random').mockReturnValue(0)

      await expect(exponentialBackoffWithJitter(1, null, err)).resolves.toEqual(
        expectedBaseDelay,
      )
      await expect(exponentialBackoffWithJitter(2, null, err)).resolves.toEqual(
        expectedBaseDelay * 2,
      )
      await expect(exponentialBackoffWithJitter(3, null, err)).resolves.toEqual(
        expectedBaseDelay * 4,
      )
      await expect(exponentialBackoffWithJitter(4, null, err)).resolves.toEqual(
        expectedBaseDelay * 8,
      )
    },
  )

  it("uses RetriableError's default delay and logs if error is not RetriableError", async () => {
    const err = new Error('test error')
    vi.spyOn(Math, 'random').mockReturnValue(0)

    await expect(exponentialBackoffWithJitter(1, null, err)).resolves.toEqual(
      DEFAULT_DELAY_MS,
    )
    expect(mocks.logError).toHaveBeenCalledWith(
      'Triggered BullMQ retry without RetriableError',
      { event: 'bullmq-retry-without-retriable-error' },
    )
  })

  it('logs if error is RetriableError with non-step delayType', async () => {
    const err = new RetriableError({
      error: 'test error',
      delayInMs: 10,
      delayType: 'queue',
    })
    vi.spyOn(Math, 'random').mockReturnValue(0)

    await expect(exponentialBackoffWithJitter(1, null, err)).resolves.toEqual(
      10,
    )
    expect(mocks.logError).toHaveBeenCalledWith(
      'Triggered BullMQ retry with RetriableError of the wrong delay type',
      {
        event: 'bullmq-retry-wrong-delay-type',
        delayType: 'queue',
      },
    )
  })

  describe('retryQueuedAt stamping', () => {
    it('stamps retryQueuedAt on the job before returning the delay', async () => {
      const err = new RetriableError({
        error: 'test error',
        delayInMs: 1000,
        delayType: 'step',
      })
      vi.spyOn(Math, 'random').mockReturnValue(0)
      vi.spyOn(Date, 'now').mockReturnValue(123456789)
      const updateData = vi.fn().mockResolvedValue(undefined)
      const job = {
        data: { flowId: 'flow-id', executionId: 'exec-id', stepId: 'step-id' },
        updateData,
      } as unknown as JobPro<IActionJobData>

      await expect(
        exponentialBackoffWithJitter(1, null, err, job),
      ).resolves.toEqual(1000)

      expect(updateData).toHaveBeenCalledWith({
        flowId: 'flow-id',
        executionId: 'exec-id',
        stepId: 'step-id',
        retryQueuedAt: 123456789,
      })
    })

    it('does not stamp anything when no job is provided', async () => {
      const err = new RetriableError({
        error: 'test error',
        delayInMs: 1000,
        delayType: 'step',
      })
      vi.spyOn(Math, 'random').mockReturnValue(0)

      await expect(exponentialBackoffWithJitter(1, null, err)).resolves.toEqual(
        1000,
      )
    })

    it('logs and still returns the delay if stamping retryQueuedAt fails', async () => {
      const err = new RetriableError({
        error: 'test error',
        delayInMs: 1000,
        delayType: 'step',
      })
      vi.spyOn(Math, 'random').mockReturnValue(0)
      const updateErr = new Error('redis down')
      const updateData = vi.fn().mockRejectedValue(updateErr)
      const job = {
        data: { flowId: 'flow-id', executionId: 'exec-id', stepId: 'step-id' },
        updateData,
      } as unknown as JobPro<IActionJobData>

      await expect(
        exponentialBackoffWithJitter(1, null, err, job),
      ).resolves.toEqual(1000)

      expect(mocks.logError).toHaveBeenCalledWith(
        'Failed to stamp retryQueuedAt for automatic retry',
        {
          event: 'backoff-stamp-retry-queued-at-failed',
          err: updateErr,
        },
      )
    })
  })
})
