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
    it('throws `step` RetriableError with default delay and no kind when retry-after header is missing', async () => {
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
        kind: undefined,
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

  describe('HTTP 401 with invalid_api_key_provided', () => {
    it('throws a config StepError asking the user to reconnect', async () => {
      const error = makeHttpError({
        message: 'Request failed with status code 401',
        status: 401,
        data: { error: { code: 'invalid_api_key_provided' } },
      })

      await expect(requestErrorHandler($, error)).rejects.toMatchObject({
        message: expect.stringContaining('"name":"Invalid Postman API key"'),
        kind: 'config',
      })
    })
  })

  describe('HTTP 400 with invalid_ip_address_used', () => {
    it('throws a config StepError about the IP whitelist', async () => {
      const error = makeHttpError({
        message: 'Request failed with status code 400',
        status: 400,
        data: { error: { code: 'invalid_ip_address_used' } },
      })

      await expect(requestErrorHandler($, error)).rejects.toMatchObject({
        message: expect.stringContaining(
          `"name":"Plumber's IPs are not whitelisted in your campaign"`,
        ),
        kind: 'config',
      })
    })
  })

  describe('Other errors', () => {
    it.each([500, 502, 503, 520, 524])(
      'should retry on %s as third-party',
      async (status) => {
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
          kind: 'third-party',
        })
      },
    )

    it('should retry on read ETIMEDOUT as third-party', async () => {
      const error = makeHttpError({
        message: 'read ETIMEDOUT',
      })

      await expect(requestErrorHandler($, error)).rejects.toThrow(
        RetriableError,
      )
      await expect(requestErrorHandler($, error)).rejects.toMatchObject({
        delayType: 'step',
        delayInMs: 3000,
        kind: 'third-party',
      })
    })

    it('should retry on connection ETIMEDOUT as third-party', async () => {
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
        kind: 'third-party',
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

    it.each([
      [400, 'multiple_auth_provided'],
      [401, 'authentication_required'],
      [403, 'forbidden_action'],
      [404, 'invalid_path'],
      [409, 'duplicate_request'],
    ])('treats %s with code %s as internal', async (status, code) => {
      const error = makeHttpError({
        message: `Request failed with status code ${status}`,
        status,
        data: { error: { code } },
      })

      await expect(requestErrorHandler($, error)).rejects.toMatchObject({
        message: expect.stringContaining('"name":"Error sending SMS"'),
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

    it('treats 504 as third-party and keeps its HttpError cause', async () => {
      const error = makeHttpError({
        message: 'Request failed with status code 504',
        status: 504,
      })

      const thrown = await requestErrorHandler($, error).catch((e) => e)
      expect(thrown).toBeInstanceOf(StepError)
      expect(thrown).toMatchObject({ kind: 'third-party', cause: error })
    })

    it('treats a network error as third-party and keeps its HttpError cause', async () => {
      const error = makeHttpError({
        message: 'read ECONNRESET',
        code: 'ECONNRESET',
      })

      const thrown = await requestErrorHandler($, error).catch((e) => e)
      expect(thrown).toBeInstanceOf(StepError)
      expect(thrown).toMatchObject({ kind: 'third-party', cause: error })
    })

    it('treats a DNS failure as third-party', async () => {
      const error = makeHttpError({
        message: 'getaddrinfo ENOTFOUND',
        code: 'ENOTFOUND',
      })

      await expect(requestErrorHandler($, error)).rejects.toMatchObject({
        kind: 'third-party',
        cause: error,
      })
    })

    it.each(['ERR_BAD_REQUEST', 'ERR_CANCELED'])(
      'treats a %s request error with no status as internal',
      async (code) => {
        const error = makeHttpError({ message: code, code })

        await expect(requestErrorHandler($, error)).rejects.toMatchObject({
          kind: 'internal',
          cause: error,
        })
      },
    )

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
