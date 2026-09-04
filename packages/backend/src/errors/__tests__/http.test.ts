import type { InternalAxiosRequestConfig } from 'axios'
import { AxiosError, AxiosHeaders } from 'axios'
import { describe, expect, it } from 'vitest'

import HttpError from '../http'

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
