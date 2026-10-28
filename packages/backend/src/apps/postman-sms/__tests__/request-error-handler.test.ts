import type { IGlobalVariable } from '@plumber/types'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import RetriableError from '@/errors/retriable-error'
import StepError from '@/errors/step'

import { makeHttpError } from '../../../../test/utils/make-http-error'
import requestErrorHandler from '../common/request-error-handler'

describe('Postman SMS request error handler', () => {
  let $: IGlobalVariable

  beforeEach(() => {
    $ = {
      app: {
        name: 'postman-sms',
      },
      step: {
        position: 2,
      },
    } as unknown as IGlobalVariable
  })

  afterEach(() => {
    vi.clearAllMocks()
    vi.restoreAllMocks()
  })

  describe('HTTP 429 (Too Many Requests)', () => {
    it('throws `step` RetriableError with default delay when retry-after header is missing', async () => {
      const error = makeHttpError({
        message: 'Request failed with status code 429',
        status: 429,
      })

      await expect(requestErrorHandler($, error)).rejects.toThrow(
        RetriableError,
      )
      await expect(requestErrorHandler($, error)).rejects.toMatchObject({
        delayType: 'step',
        delayInMs: 3000,
      })
    })
  })

  describe('HTTP 400 with parameter_invalid', () => {
    it('throws StepError with campaign template setup message', async () => {
      const error = makeHttpError({
        message: 'Request failed with status code 400',
        status: 400,
        data: {
          error: {
            code: 'parameter_invalid',
          },
        },
      })

      await expect(requestErrorHandler($, error)).rejects.toThrow(StepError)
    })
  })

  describe('Other errors', () => {
    it.each([500, 502, 503, 520, 524])('should retry on %s', async (status) => {
      const error = makeHttpError({
        message: 'Internal server error',
        status,
      })

      await expect(requestErrorHandler($, error)).rejects.toThrow(
        RetriableError,
      )
      await expect(requestErrorHandler($, error)).rejects.toMatchObject({
        delayType: 'step',
        delayInMs: 3000,
      })
    })

    it('should retry on read ETIMEDOUT', async () => {
      const error = makeHttpError({
        message: 'read ETIMEDOUT',
      })

      await expect(requestErrorHandler($, error)).rejects.toThrow(
        RetriableError,
      )
      await expect(requestErrorHandler($, error)).rejects.toMatchObject({
        delayType: 'step',
        delayInMs: 3000,
      })
    })

    it('should retry on connection ETIMEDOUT', async () => {
      const error = makeHttpError({
        message: 'connect ETIMEDOUT 1.2.3.4:443',
        code: 'ETIMEDOUT',
      })

      await expect(requestErrorHandler($, error)).rejects.toThrow(
        RetriableError,
      )
      await expect(requestErrorHandler($, error)).rejects.toMatchObject({
        delayType: 'step',
        delayInMs: 3000,
      })
    })

    it('should not crash when HTTP error response data is missing', async () => {
      const error = makeHttpError({
        message: 'Request failed with status code 400',
        status: 400,
      })

      await expect(requestErrorHandler($, error)).rejects.toThrow(StepError)
      await expect(requestErrorHandler($, error)).rejects.not.toThrow(TypeError)
    })
  })
})
