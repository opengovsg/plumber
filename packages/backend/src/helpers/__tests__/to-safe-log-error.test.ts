import axios from 'axios'
import { describe, expect, it } from 'vitest'

import { toSafeLogError } from '../to-safe-log-error'

describe('toSafeLogError', () => {
  it('keeps name and message for a plain Error', () => {
    expect(toSafeLogError(new Error('boom'))).toEqual({
      name: 'Error',
      message: 'boom',
    })
  })

  it('keeps only axios status and message', () => {
    const axiosError = new axios.AxiosError(
      'Request failed with status code 401',
      'ERR_BAD_REQUEST',
      {
        url: 'https://example.com/secret-path',
        headers: { Authorization: 'Bearer leaked-token' },
      } as never,
      { socket: { remoteAddress: '10.0.0.1' } },
      {
        status: 401,
        statusText: 'Unauthorized',
        headers: { 'www-authenticate': 'Bearer' },
        config: {} as never,
        data: { access_token: 'leaked-token', detail: 'nope' },
      },
    )

    const safe = toSafeLogError(axiosError)

    expect(safe).toEqual({
      name: 'AxiosError',
      message: 'Request failed with status code 401',
      status: 401,
    })
    expect(JSON.stringify(safe)).not.toContain('leaked-token')
    expect(JSON.stringify(safe)).not.toContain('secret-path')
    expect(JSON.stringify(safe)).not.toContain('Authorization')
  })

  it('does not stringify unknown thrown values', () => {
    expect(toSafeLogError({ token: 'leaked-token' })).toEqual({
      name: 'UnknownError',
      message: 'Non-error thrown',
    })
  })
})
