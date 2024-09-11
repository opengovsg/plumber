import { IGlobalVariable } from '@plumber/types'

import { AxiosError } from 'axios'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import HttpError from '@/errors/http'
import StepError from '@/errors/step'

import app from '../..'
import makeRequestAction from '../../actions/http-request'
import { RECURSIVE_WEBHOOK_ERROR_NAME } from '../../common/check-urls'

const mocks = vi.hoisted(() => ({
  httpRequest: vi.fn(),
  isUrlAllowed: vi.fn(() => true),
}))

vi.mock('../../common/ip-resolver', () => ({
  isUrlAllowed: mocks.isUrlAllowed,
}))

describe('make http request', () => {
  let $: IGlobalVariable

  beforeEach(() => {
    $ = {
      auth: {
        set: vi.fn(),
        data: {},
      },
      step: {
        id: 'herp-derp',
        appKey: 'webhook',
        position: 1,
        parameters: {},
      },
      http: {
        request: mocks.httpRequest,
      } as unknown as IGlobalVariable['http'],
      setActionItem: vi.fn(),
      app,
    }
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('invokes the webhook as configured', async () => {
    $.step.parameters.method = 'POST'
    $.step.parameters.data = 'meep meep'
    $.step.parameters.url = 'http://test.local/endpoint?1234'
    mocks.httpRequest.mockReturnValue('mock response')

    await makeRequestAction.run($).catch(() => null)
    expect(mocks.httpRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        url: $.step.parameters.url,
        method: $.step.parameters.method,
        data: $.step.parameters.data,
      }),
    )
  })

  it('should throw an error for error with http request', async () => {
    $.step.parameters.method = 'POST'
    $.step.parameters.data = 'meep meep'
    $.step.parameters.url = 'http://test.local/endpoint?1234'
    const error403 = {
      response: {
        status: 403,
        statusText: 'forbidden',
      },
    } as AxiosError
    const httpError = new HttpError(error403)
    mocks.httpRequest.mockRejectedValueOnce(httpError)

    // throw partial step error message
    await expect(makeRequestAction.run($)).rejects.toThrowError(
      'Status code: 403',
    )
  })

  it('should follow redirect once', async () => {
    mocks.isUrlAllowed.mockResolvedValueOnce(false)
    $.step.parameters.method = 'POST'
    $.step.parameters.data = 'meep meep'
    $.step.parameters.url = 'http://test.local/endpoint?1234'
    mocks.httpRequest.mockResolvedValue({
      status: 302,
      headers: {
        location: 'https://redirect.com',
      },
    })
    await makeRequestAction.run($)
    expect(mocks.httpRequest).toHaveBeenCalledTimes(2)
  })

  it('should follow redirect with GET if 301 or 302', async () => {
    mocks.isUrlAllowed.mockResolvedValueOnce(false)
    $.step.parameters.method = 'POST'
    $.step.parameters.data = 'meep meep'
    $.step.parameters.url = 'http://test.local/endpoint?1234'
    mocks.httpRequest.mockResolvedValue({
      status: 301,
      headers: {
        location: 'https://redirect.com',
      },
    })
    await makeRequestAction.run($)
    expect(mocks.httpRequest).toHaveBeenCalledTimes(2)
    expect(mocks.httpRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        url: 'http://test.local/endpoint?1234',
        method: 'POST',
        data: 'meep meep',
      }),
    )
    expect(mocks.httpRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        url: 'https://redirect.com',
        method: 'GET',
        data: 'meep meep',
      }),
    )
  })

  it('should follow redirect with same method if 307 or 308', async () => {
    mocks.isUrlAllowed.mockResolvedValueOnce(false)
    $.step.parameters.method = 'POST'
    $.step.parameters.data = 'meep meep'
    $.step.parameters.url = 'http://test.local/endpoint?1234'
    mocks.httpRequest.mockResolvedValue({
      status: 307,
      headers: {
        location: 'https://redirect.com',
      },
    })
    await makeRequestAction.run($)
    expect(mocks.httpRequest).toHaveBeenCalledTimes(2)
    expect(mocks.httpRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        url: 'http://test.local/endpoint?1234',
        method: 'POST',
        data: 'meep meep',
      }),
    )
    expect(mocks.httpRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        url: 'https://redirect.com',
        method: 'POST',
        data: 'meep meep',
      }),
    )
  })

  it('should not redirect if no header location', async () => {
    mocks.isUrlAllowed.mockResolvedValueOnce(false)
    $.step.parameters.method = 'POST'
    $.step.parameters.data = 'meep meep'
    $.step.parameters.url = 'http://test.local/endpoint?1234'
    mocks.httpRequest.mockResolvedValue({
      status: 307,
    })
    await expect(makeRequestAction.run($)).rejects.toThrow('No location header')
    expect(mocks.httpRequest).toHaveBeenCalledTimes(1)
  })

  it.each([
    'http://staging.plumber.gov.sg/webhooks/abc-def-123',
    'https://www.plumber.gov.sg/webhooks/abc-def-123',
    'https://plumber.gov.sg:443/webhooks/abc-def-123',
    'HTTPS://PLUMBER.GOV.SG/WEBHOOKS/ABC-DEF-123',
    'HtTpS://WwW.PluMbEr.GoV.Sg:443/WeBHoOkS/AbC-DeF-123',
    'http://beta.plumber.gov.sg',
  ])('does not invoke Plumber webhooks', async (url: string) => {
    $.step.parameters.method = 'GET'
    $.step.parameters.data = 'meep meep'
    $.step.parameters.url = url
    await expect(makeRequestAction.run($)).rejects.toThrowError(StepError)
  })

  it('should throw step error if user redirects to plumber', async () => {
    $.step.parameters.method = 'GET'
    $.step.parameters.data = 'go crazy'
    $.step.parameters.url = 'https://coolbeans.io'
    const recursiveWebhookError = new Error(RECURSIVE_WEBHOOK_ERROR_NAME)
    mocks.httpRequest.mockRejectedValueOnce(recursiveWebhookError)
    await expect(makeRequestAction.run($)).rejects.toThrowError(StepError)
  })
})
