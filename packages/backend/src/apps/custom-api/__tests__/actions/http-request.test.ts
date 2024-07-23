import { IGlobalVariable } from '@plumber/types'

import { AxiosError } from 'axios'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import HttpError from '@/errors/http'
import StepError from '@/errors/step'

import app from '../..'
import makeRequestAction, {
  RECURSIVE_WEBHOOK_ERROR_NAME,
} from '../../actions/http-request'

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
    expect(mocks.isUrlAllowed).toHaveBeenCalledOnce()
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

  it('should throw an error if url is not malformed', async () => {
    $.step.parameters.url = 'malformed-urll'
    await expect(makeRequestAction.run($)).rejects.toThrowError('Invalid URL')
  })

  it('should throw an error if url is not allowed', async () => {
    mocks.isUrlAllowed.mockResolvedValueOnce(false)
    $.step.parameters.url = 'https://internalip.com'
    await expect(makeRequestAction.run($)).rejects.toThrowError(
      'The URL you are trying to call is not allowed.',
    )
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
