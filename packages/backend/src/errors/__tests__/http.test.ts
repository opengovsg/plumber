import type { InternalAxiosRequestConfig } from 'axios'
import { AxiosError, AxiosHeaders } from 'axios'
import { describe, expect, it } from 'vitest'

import { makeHttpError } from '@/../test/utils/make-http-error'

import HttpError, { isNetworkError } from '../http'

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
