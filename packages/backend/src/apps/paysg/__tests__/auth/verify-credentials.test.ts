import type { IGlobalVariable } from '@plumber/types'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import app from '../..'
import verifyCredentials from '../../auth/verify-credentials'

const mocks = vi.hoisted(() => ({
  httpGet: vi.fn(),
}))

describe('Verify credentials', () => {
  let $: IGlobalVariable
  beforeEach(() => {
    $ = {
      auth: {
        set: vi.fn(),
        data: {
          apiKey: 'paysg_stag_abcd',
          paymentServiceId: 'sample-payment-service-id',
          screenName: 'my screen name',
        },
      },
      http: {
        get: mocks.httpGet,
      } as unknown as IGlobalVariable['http'],
      app,
    }
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should throw an error if the API key is not set', async () => {
    $.auth.data.apiKey = ''
    await expect(verifyCredentials($)).rejects.toThrow()
  })

  it('should throw an error if payment service id is not set', async () => {
    $.auth.data.paymentServiceId = ''
    await expect(verifyCredentials($)).rejects.toThrow()
  })

  it('should throw an error if test api returns a 401 or 403', async () => {
    mocks.httpGet.mockRejectedValue({ response: { status: 401 } })
    await expect(verifyCredentials($)).rejects.toThrow('Invalid credentials')
    mocks.httpGet.mockRejectedValue({ response: { status: 403 } })
    await expect(verifyCredentials($)).rejects.toThrow('Invalid credentials')
  })

  it('should throw an error if test api returns a different error', async () => {
    mocks.httpGet.mockRejectedValue({ response: { status: 404 } })
    await expect(verifyCredentials($)).rejects.toThrow(
      'Unable to validate payment service id and api key',
    )
  })

  it('should set the screen name and env', async () => {
    mocks.httpGet.mockResolvedValue({})
    await verifyCredentials($)
    expect($.auth.set).toHaveBeenCalledWith({
      screenName: 'my screen name [STAGING]',
      env: 'staging',
    })
  })
})
