import type { IGlobalVariable } from '@plumber/types'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { makeHttpError } from '@/../test/utils/make-http-error'

import rateLimitHandler from '../../common/interceptor/rate-limit'

const mocks = vi.hoisted(() => ({
  logError: vi.fn(),
}))

vi.mock('@/helpers/logger', () => ({
  default: { error: mocks.logError },
}))

const $ = {
  execution: { id: 'execution-id' },
  flow: { id: 'flow-id' },
  step: { id: 'step-id' },
} as unknown as IGlobalVariable

describe('telegram rate limit handler', () => {
  beforeEach(() => {
    mocks.logError.mockClear()
  })

  it('adds 45 seconds to the retry delay of a 429', async () => {
    const error = makeHttpError({
      status: 429,
      headers: { 'retry-after': '30' },
    })

    await expect(rateLimitHandler!($, error)).rejects.toBe(error)

    expect(error.response.headers['retry-after']).toBe('75')
    expect(error.getRetryInfo()).toEqual({ retriable: true, delayInMs: 75_000 })
  })

  it('leaves a 429 without a numeric Retry-After unchanged', async () => {
    const error = makeHttpError({ status: 429 })

    await expect(rateLimitHandler!($, error)).resolves.toBeUndefined()

    expect(error.getRetryInfo()).toEqual({
      retriable: true,
      delayInMs: 'default',
    })
  })

  it('ignores errors other than 429', async () => {
    const error = makeHttpError({
      status: 400,
      headers: { 'retry-after': '30' },
    })

    await expect(rateLimitHandler!($, error)).resolves.toBeUndefined()

    expect(error.response.headers['retry-after']).toBe('30')
  })
})
