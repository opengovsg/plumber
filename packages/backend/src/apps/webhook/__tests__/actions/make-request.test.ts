import { IGlobalVariable } from '@plumber/types'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import app from '../..'
import makeRequestAction from '../../actions/make-request'

const mocks = vi.hoisted(() => ({
  httpRequest: vi.fn(),
}))

describe('create row', () => {
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

    makeRequestAction.run($)
    expect(mocks.httpRequest).toHaveBeenCalledWith({
      url: $.step.parameters.url,
      method: $.step.parameters.method,
      data: $.step.parameters.data,
    })
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
    expect(makeRequestAction.run($)).rejects.toThrowError(
      'Recursively invoking Plumber webhooks is prohibited.',
    )
  })
})
