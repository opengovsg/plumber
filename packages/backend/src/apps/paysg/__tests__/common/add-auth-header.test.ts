import type { IGlobalVariable } from '@plumber/types'

import { InternalAxiosRequestConfig } from 'axios'
import { describe, expect, it, vi } from 'vitest'

import addAuthHeader from '../../common/add-auth-header'
import { getApiBaseUrl } from '../../common/api'

describe('Add auth headers', async () => {
  it('should correctly set the api key and base url', async () => {
    const $ = {
      auth: {
        data: {
          apiKey: 'paysg_stag_abcd',
          paymentServiceId: 'sample-payment-service-id',
        },
        set: vi.fn(),
      },
      flow: {
        id: 'hihi',
      },
    } as unknown as IGlobalVariable
    const requestConfig = {
      headers: {
        set: vi.fn(),
      },
    } as unknown as InternalAxiosRequestConfig<any> // cant be bothered casting

    const actual = await addAuthHeader($, requestConfig)

    expect(actual.baseURL === getApiBaseUrl($.auth.data.apiKey as string))
    expect(requestConfig.headers.set).toBeCalledWith(
      'x-api-key',
      $.auth.data.apiKey,
    )
  })

  it('should throw an error if api key is missing', async () => {
    const $ = {
      auth: {
        data: {
          paymentServiceId: 'sample-payment-service-id',
        },
        set: vi.fn(),
      },
      flow: {
        id: 'hihi',
      },
    } as unknown as IGlobalVariable

    await expect(() => addAuthHeader($, {} as any)).rejects.toThrowError(
      'Missing API key or payment service ID',
    )
  })

  it('should throw an error if payment service id is missing', async () => {
    const $ = {
      auth: {
        data: {
          apiKey: 'paysg_stag_abcd',
        },
        set: vi.fn(),
      },
      flow: {
        id: 'hihi',
      },
    } as unknown as IGlobalVariable

    await expect(() => addAuthHeader($, {} as any)).rejects.toThrowError(
      'Missing API key or payment service ID',
    )
  })

  it('should throw an error is no base url is obtained from the api key', async () => {
    const $ = {
      auth: {
        data: {
          apiKey: 'invalid_key',
          paymentServiceId: 'sample-payment-service-id',
        },
        set: vi.fn(),
      },
      flow: {
        id: 'hihi',
      },
    } as unknown as IGlobalVariable

    const requestConfig = {
      headers: {
        set: vi.fn(),
      },
    } as unknown as InternalAxiosRequestConfig<any> // cant be bothered casting

    await expect(() => addAuthHeader($, requestConfig)).rejects.toThrowError(
      'API key has unrecognized prefix!',
    )
  })
})
