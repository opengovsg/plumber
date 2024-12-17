import { IGlobalVariable } from '@plumber/types'

import { AxiosError } from 'axios'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import HttpError from '@/errors/http'
import StepError from '@/errors/step'

import app from '../..'
import makeRequestAction from '../../actions/http-request'
import {
  DISALLOWED_IP_RESOLVED_ERROR,
  RECURSIVE_WEBHOOK_ERROR_NAME,
} from '../../common/check-urls'

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

  it('invokes the webhook with custom headers', async () => {
    $.step.parameters.method = 'POST'
    $.step.parameters.data = 'meep meep'
    $.step.parameters.url = 'http://test.local/endpoint?1234'
    $.step.parameters.customHeaders = [
      { key: 'Key1', value: 'Value1' },
      { key: 'Key2', value: 'Value2' },
    ]
    mocks.httpRequest.mockReturnValue('mock response')

    await makeRequestAction.run($).catch(() => null)
    expect(mocks.httpRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        url: $.step.parameters.url,
        method: $.step.parameters.method,
        data: $.step.parameters.data,
        headers: {
          Key1: 'Value1',
          Key2: 'Value2',
        },
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

  it.each([[{ value: 'test' }], [{ key: 'test' }]])(
    'should throw error for invalid custom headers (no field)',
    async () => {
      $.step.parameters.customHeaders = [{ value: 'test' }]
      await expect(makeRequestAction.run($)).rejects.toThrowError()
    },
  )

  it('should throw error for invalid custom headers (duplicate keys)', async () => {
    $.step.parameters.customHeaders = [
      { key: 'test', value: 'value1' },
      { key: 'test', value: 'value2' },
    ]
    await expect(makeRequestAction.run($)).rejects.toThrowError()
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

  it('should throw step error if user redirects to plumber', async () => {
    $.step.parameters.method = 'GET'
    $.step.parameters.data = 'go crazy'
    $.step.parameters.url = 'http://beta.plumber.gov.sg'
    const recursiveWebhookError = new Error(RECURSIVE_WEBHOOK_ERROR_NAME)
    mocks.httpRequest.mockRejectedValueOnce(recursiveWebhookError)
    await expect(makeRequestAction.run($)).rejects.toThrowError(StepError)
  })

  it('should throw step error if url resolves to blacklisted ip', async () => {
    $.step.parameters.method = 'GET'
    $.step.parameters.data = 'go crazy'
    $.step.parameters.url = 'http://1.2.3.4'
    const disallowedIpError = new Error(DISALLOWED_IP_RESOLVED_ERROR)
    mocks.httpRequest.mockRejectedValueOnce(disallowedIpError)
    await expect(makeRequestAction.run($)).rejects.toThrowError(StepError)
  })

  describe('tests that data is valid JSON', () => {
    // NOTE: caters for existing users that are sending strings in the data field
    it.each(['[1, 2, 3]', 'meep meep'])(
      'should not throw error if data is string',
      async (testData: any) => {
        $.step.parameters.method = 'POST'
        $.step.parameters.data = testData
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
      },
    )

    it.each([
      '{"abc": 123}',
      '{"abc": "def", "ghi": 456, "jkl": {"nested": "nested-value"}}',
      '{"abc": "def", "ghi": 456, "jkl": {"nested": {"nested-nested": "nested-nested-value"}}}',
      JSON.stringify({ data: undefined }),
      JSON.stringify({ data: null }),
      null,
      '',
    ])(
      'should not throw error if data is valid JSON or null or empty string',
      async (testJSON: any) => {
        $.step.parameters.method = 'POST'
        $.step.parameters.data = testJSON

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
      },
    )

    it.each([
      '{"abc": 123',
      '"abc": 123}',
      '{""abc"": "def"}',
      '{"name": "zuck""}',
      '{"name": "zuck", "age": "40}',
      '{ this looks like json but isnt }',
    ])(
      'should throw error if data is not valid JSON',
      async (testJSON: any) => {
        $.step.parameters.method = 'POST'
        $.step.parameters.data = testJSON
        $.step.parameters.url = 'http://test.local/endpoint?1234'

        mocks.httpRequest.mockReturnValue('mock response')
        await expect(makeRequestAction.run($)).rejects.toThrowError(
          'Invalid JSON data',
        )
      },
    )
  })
})
