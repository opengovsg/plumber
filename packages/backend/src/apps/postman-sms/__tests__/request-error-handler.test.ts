import type { IGlobalVariable } from '@plumber/types'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import RetriableError from '@/errors/retriable-error'
import StepError from '@/errors/step'
import { isRetriableHttpError } from '@/helpers/actions'

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
      await expect(requestErrorHandler($, error)).rejects.toMatchObject({
        kind: 'config',
      })
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

  describe('catch-all kind', () => {
    it('keeps the StepError name', async () => {
      const error = makeHttpError({ message: 'bad request', status: 400 })

      await expect(requestErrorHandler($, error)).rejects.toMatchObject({
        message: expect.stringContaining('"name":"Error sending SMS"'),
      })
    })

    it('treats invalid_ip_address_used as internal', async () => {
      const error = makeHttpError({
        message: 'Request failed with status code 400',
        status: 400,
        data: { error: { code: 'invalid_ip_address_used' } },
      })

      await expect(requestErrorHandler($, error)).rejects.toMatchObject({
        kind: 'internal',
        cause: error,
      })
    })

    it.each([400, 401, 403, 404])(
      'treats unlisted %s as internal',
      async (status) => {
        const error = makeHttpError({
          message: `Request failed with status code ${status}`,
          status,
          code: 'ERR_BAD_REQUEST',
        })

        await expect(requestErrorHandler($, error)).rejects.toMatchObject({
          kind: 'internal',
          cause: error,
        })
      },
    )

    it('treats 504 as third-party and keeps it retriable', async () => {
      const error = makeHttpError({
        message: 'Request failed with status code 504',
        status: 504,
      })

      const thrown = await requestErrorHandler($, error).catch((e) => e)
      expect(thrown).toBeInstanceOf(StepError)
      expect(thrown).toMatchObject({ kind: 'third-party', cause: error })
      expect(isRetriableHttpError(thrown.cause)).toBe(true)
    })

    it('treats a network error as third-party and keeps it retriable', async () => {
      const error = makeHttpError({
        message: 'read ECONNRESET',
        code: 'ECONNRESET',
      })

      const thrown = await requestErrorHandler($, error).catch((e) => e)
      expect(thrown).toBeInstanceOf(StepError)
      expect(thrown).toMatchObject({ kind: 'third-party', cause: error })
      expect(isRetriableHttpError(thrown.cause)).toBe(true)
    })

    it('treats a beforeRequest error as internal', async () => {
      const error = makeHttpError({
        message: 'Unsupported postman environment',
      })

      await expect(requestErrorHandler($, error)).rejects.toMatchObject({
        kind: 'internal',
        cause: error,
      })
    })
  })
})
