import type { InternalAxiosRequestConfig } from 'axios'
import { AxiosError, AxiosHeaders } from 'axios'
import { describe, expect, it } from 'vitest'

import { makeHttpError } from '@/../test/utils/make-http-error'

import HttpError, { isNetworkError, isNetworkErrorCode } from '../http'

describe('http error', () => {
  it('removes non-allow-listed headers', () => {
    const requestHeaders = new AxiosHeaders()
    requestHeaders.set('content-type', 'application/json')
    requestHeaders.set('authorization', 'Bearer 12345')

    const responseHeaders = new AxiosHeaders()
    responseHeaders.set('content-type', 'text/html')
    responseHeaders.set('authorization', 'Bearer abcde')
    responseHeaders.set('retry-after', '10')

    const axiosError = new AxiosError(
      'test error',
      AxiosError.ERR_BAD_RESPONSE,
      {
        headers: requestHeaders,
      },
      'request data',
      {
        status: 429,
        statusText: 'Too many requests',
        data: '',
        // Unused by HttpError (it reads error.config, not error.response.config);
        // stubbed since AxiosResponse.config is required.
        config: {} as InternalAxiosRequestConfig,
        headers: responseHeaders,
      },
    )

    const httpError = new HttpError(axiosError)
    expect(httpError.response.headers).toStrictEqual({
      'retry-after': '10',
    })
    expect(httpError.response.config?.headers).toBeUndefined()
  })
})

describe('HttpError retry', () => {
  const TWELVE_HOURS_IN_SECONDS = 12 * 60 * 60

  it('waits for a Retry-After in seconds', () => {
    const error = makeHttpError({
      status: 422,
      headers: { 'retry-after': '15' },
    })

    expect(error.retry).toEqual({ retriable: true, delayInMs: 15_000 })
  })

  it('waits for a Retry-After date', () => {
    const retryAfter = new Date(Date.now() + 60_000).toUTCString()
    const error = makeHttpError({
      status: 503,
      headers: { 'retry-after': retryAfter },
    })

    expect(error.retry.retriable).toBe(true)
    expect(error.retry.retriable && error.retry.delayInMs).toBeGreaterThan(0)
  })

  it('retries a Retry-After of exactly 12 hours', () => {
    const error = makeHttpError({
      status: 429,
      headers: { 'retry-after': `${TWELVE_HOURS_IN_SECONDS}` },
    })

    expect(error.retry).toEqual({
      retriable: true,
      delayInMs: TWELVE_HOURS_IN_SECONDS * 1000,
    })
  })

  it('does not retry a Retry-After over 12 hours, even on a 429', () => {
    const error = makeHttpError({
      status: 429,
      headers: { 'retry-after': `${TWELVE_HOURS_IN_SECONDS + 1}` },
    })

    expect(error.retry).toEqual({
      retriable: false,
      retryAfterMs: (TWELVE_HOURS_IN_SECONDS + 1) * 1000,
    })
  })

  it.each([429, 504])('retries status %i after the default delay', (status) => {
    expect(makeHttpError({ status }).retry).toEqual({
      retriable: true,
      delayInMs: 'default',
    })
  })

  it('falls back to the status when Retry-After is invalid', () => {
    const headers = { 'retry-after': 'soon' }

    expect(makeHttpError({ status: 429, headers }).retry).toEqual({
      retriable: true,
      delayInMs: 'default',
    })
    expect(makeHttpError({ status: 400, headers }).retry).toEqual({
      retriable: false,
    })
  })

  it.each(['read ECONNRESET', 'connect ETIMEDOUT 10.0.0.1:443'])(
    'retries the network error message %s',
    (message) => {
      expect(makeHttpError({ message }).retry).toEqual({
        retriable: true,
        delayInMs: 'default',
      })
    },
  )

  it.each([
    ['status 400', makeHttpError({ status: 400 })],
    ['status 503', makeHttpError({ status: 503 })],
    ['ECONNREFUSED', makeHttpError({ message: 'connect ECONNREFUSED' })],
    // Matches the message, not the code, so this reset does not retry yet.
    [
      'a socket hang up with code ECONNRESET',
      makeHttpError({ message: 'socket hang up', code: 'ECONNRESET' }),
    ],
  ])('does not retry %s', (_, error) => {
    expect(error.retry).toEqual({ retriable: false })
  })

  describe('setRetryAfter', () => {
    it('re-parses retry from the new header', () => {
      const error = makeHttpError({
        status: 429,
        headers: { 'retry-after': '15' },
      })

      error.setRetryAfter('60')

      expect(error.response.headers['retry-after']).toBe('60')
      expect(error.retry).toEqual({ retriable: true, delayInMs: 60_000 })
    })

    it('stops retrying when the new header is over 12 hours', () => {
      const error = makeHttpError({ status: 429 })

      error.setRetryAfter(`${TWELVE_HOURS_IN_SECONDS + 1}`)

      expect(error.retry.retriable).toBe(false)
    })
  })
})

describe('isNetworkError', () => {
  it.each([
    'ECONNREFUSED',
    'ECONNRESET',
    'ECONNABORTED',
    'ETIMEDOUT',
    'ENOTFOUND',
    'EAI_AGAIN',
    'EPIPE',
    'EHOSTUNREACH',
    'ENETUNREACH',
    'EPROTO',
    'CERT_HAS_EXPIRED',
  ])('is true for %s with no response', (code) => {
    expect(isNetworkError(makeHttpError({ code, message: code }))).toBe(true)
  })

  it.each(['ERR_BAD_REQUEST', 'ERR_CANCELED', 'ERR_INVALID_URL'])(
    'is false for the axios request error %s',
    (code) => {
      expect(isNetworkError(makeHttpError({ code, message: code }))).toBe(false)
    },
  )

  it('is false without a code', () => {
    expect(isNetworkError(makeHttpError({ message: 'beforeRequest' }))).toBe(
      false,
    )
  })

  it('is false when the server responded', () => {
    expect(
      isNetworkError(makeHttpError({ status: 400, code: 'ERR_BAD_REQUEST' })),
    ).toBe(false)
  })
})

describe('isNetworkErrorCode', () => {
  it.each(['ECONNRESET', 'ENOTFOUND', 'CERT_HAS_EXPIRED'])(
    'is true for %s',
    (code) => {
      expect(isNetworkErrorCode(code)).toBe(true)
    },
  )

  it.each([['ERR_CANCELED'], [''], [undefined], [123], [null]])(
    'is false for %s',
    (code) => {
      expect(isNetworkErrorCode(code)).toBe(false)
    },
  )
})
