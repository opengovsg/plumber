import { IGlobalVariable } from '@plumber/types'
import { AxiosError } from 'axios'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import HttpError from '@/errors/http'
import StepError from '@/errors/step'

import app from '../..'
import makeRequestAction from '../../actions/http-request'
import {
  CUSTOM_API_TIMEOUT,
  DISALLOWED_IP_RESOLVED_ERROR,
  RECURSIVE_WEBHOOK_ERROR,
} from '../../common/constants'

const mocks = vi.hoisted(() => ({
  httpRequest: vi.fn(),
  isUrlAllowed: vi.fn(() => true),
  stepQueryResult: vi.fn<() => any>(() => ({
    config: {},
  })),
  addInterceptors: vi.fn(),
}))

vi.mock('../../common/ip-resolver', () => {
  const originalModule = vi.importActual('../../common/ip-resolver')
  return {
    ...originalModule,
    safeAxiosLookup: mocks.isUrlAllowed,
  }
})

vi.mock('../../common/add-interceptors', () => ({
  default: mocks.addInterceptors,
}))

vi.mock('@/models/step', () => ({
  default: {
    query: () => ({
      findById: () => ({
        throwIfNotFound: mocks.stepQueryResult,
      }),
    }),
  },
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
        key: 'catchRawWebhook',
        position: 1,
        parameters: {},
        version: 1,
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
    await makeRequestAction.run($).catch((): void => null)
    expect(mocks.httpRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        url: $.step.parameters.url,
        method: $.step.parameters.method,
        data: $.step.parameters.data,
        responseType: 'stream',
      }),
    )
  })

  it('allows Authorization headers on live runs for existing steps', async () => {
    $.step.parameters.method = 'GET'
    $.step.parameters.url = 'http://test.local/endpoint'
    $.step.parameters.customHeaders = [
      { key: 'Authorization', value: 'Bearer sk-live-secret' },
    ]
    mocks.httpRequest.mockResolvedValueOnce({ data: 'response' })

    await makeRequestAction.run($)

    expect(mocks.httpRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        headers: {
          Authorization: 'Bearer sk-live-secret',
        },
      }),
    )
  })

  it('fails check step when Authorization is a static secret', async () => {
    $.step.parameters.method = 'GET'
    $.step.parameters.url = 'http://test.local/endpoint'
    $.step.parameters.customHeaders = [
      { key: 'Authorization', value: 'Bearer sk-live-secret' },
    ]

    await expect(makeRequestAction.testRun?.($)).rejects.toThrow(
      /Do not store secrets in Custom Headers/,
    )
    expect(mocks.httpRequest).not.toHaveBeenCalled()
  })

  it('fails check step for other static credential headers', async () => {
    $.step.parameters.method = 'GET'
    $.step.parameters.url = 'http://test.local/endpoint'
    $.step.parameters.customHeaders = [{ key: 'X-API-Key', value: 'abc123' }]

    await expect(makeRequestAction.testRun?.($)).rejects.toThrow('X-API-Key')
    expect(mocks.httpRequest).not.toHaveBeenCalled()
  })

  it('allows check step when Authorization uses a previous-step variable', async () => {
    $.step.parameters.method = 'GET'
    $.step.parameters.url = 'http://test.local/endpoint'
    $.step.parameters.customHeaders = [
      {
        key: 'Authorization',
        value:
          'Bearer {{step.aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee.data.token}}',
      },
    ]
    mocks.httpRequest.mockResolvedValueOnce({ data: 'response' })

    await makeRequestAction.testRun?.($)

    expect(mocks.httpRequest).toHaveBeenCalled()
  })

  it('prefers stored (unsubstituted) headers when checking secrets', async () => {
    $.step.parameters.method = 'GET'
    $.step.parameters.url = 'http://test.local/endpoint'
    // Computed value after variable substitution. Looks like a static secret.
    $.step.parameters.customHeaders = [
      { key: 'Authorization', value: 'Bearer resolved-token' },
    ]
    mocks.stepQueryResult.mockReturnValue({
      config: {},
      parameters: {
        customHeaders: [
          {
            key: 'Authorization',
            value:
              'Bearer {{step.aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee.data.token}}',
          },
        ],
      },
    })
    mocks.httpRequest.mockResolvedValueOnce({ data: 'response' })

    await makeRequestAction.testRun?.($)

    expect(mocks.httpRequest).toHaveBeenCalled()
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

    await makeRequestAction.run($).catch((): void => null)
    expect(mocks.httpRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        url: $.step.parameters.url,
        method: $.step.parameters.method,
        data: $.step.parameters.data,
        responseType: 'stream',
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

  it('should follow redirect with GET if 301 or 302 without body and content-type header', async () => {
    mocks.isUrlAllowed.mockResolvedValueOnce(false)
    $.step.parameters.method = 'POST'
    $.step.parameters.data = 'meep meep'
    $.step.parameters.customHeaders = [
      { key: 'Content-Type', value: 'plain/text' },
      { key: 'Key2', value: 'Value2' },
    ]
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
        headers: {
          'Content-Type': 'plain/text',
          Key2: 'Value2',
        },
        data: 'meep meep',
        responseType: 'stream',
      }),
    )
    expect(mocks.httpRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        url: 'https://redirect.com',
        method: 'GET',
        headers: {
          Key2: 'Value2',
        },
        responseType: 'stream',
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
        responseType: 'stream',
      }),
    )
    expect(mocks.httpRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        url: 'https://redirect.com',
        method: 'POST',
        data: 'meep meep',
        responseType: 'stream',
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
    const recursiveWebhookError = new Error(RECURSIVE_WEBHOOK_ERROR)
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

  it('should include timeout in the request config', async () => {
    $.step.parameters.method = 'GET'
    $.step.parameters.url = 'http://test.local/endpoint'
    mocks.httpRequest.mockResolvedValueOnce({ data: 'response' })

    await makeRequestAction.run($)

    expect(mocks.httpRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        timeout: CUSTOM_API_TIMEOUT,
        responseType: 'stream',
      }),
    )
  })

  it('should use admin override timeout if set', async () => {
    $.step.parameters.method = 'GET'
    $.step.parameters.url = 'http://test.local/endpoint'

    // Set up the mock for this specific test
    mocks.stepQueryResult.mockResolvedValueOnce({
      config: {
        adminOverride: {
          customApiTimeout: 360000,
        },
      },
    })
    mocks.httpRequest.mockResolvedValueOnce({ data: 'response' })

    await makeRequestAction.run($)

    expect(mocks.httpRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        timeout: 360000,
        responseType: 'stream',
      }),
    )
  })

  it.each(['not a number', '33', undefined, null])(
    'should use default timeout if admin override is %s',
    async (testOverride: any) => {
      $.step.parameters.method = 'GET'
      $.step.parameters.url = 'http://test.local/endpoint'

      mocks.stepQueryResult.mockResolvedValueOnce({
        config: {
          adminOverride: {
            customApiTimeout: testOverride,
          },
        },
      })
      mocks.httpRequest.mockResolvedValueOnce({ data: 'response' })

      await makeRequestAction.run($)

      expect(mocks.httpRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          timeout: CUSTOM_API_TIMEOUT,
          responseType: 'stream',
        }),
      )
    },
  )

  it('should throw step error if request times out', async () => {
    $.step.parameters.method = 'GET'
    $.step.parameters.url = 'http://test.local/endpoint'
    const testTimeout = 1000
    mocks.stepQueryResult.mockResolvedValueOnce({
      config: {
        adminOverride: {
          customApiTimeout: testTimeout,
        },
      },
    })

    // Simulate a long-running request by delaying the response
    mocks.httpRequest.mockImplementationOnce(
      () =>
        new Promise((_, reject) => {
          const timeoutError = new Error(
            `HTTP request exceeded timeout of ${testTimeout / 1000}s`,
          )
          setTimeout(() => {
            reject(timeoutError)
          }, 2000) // 2 seconds delay
        }),
    )

    await expect(makeRequestAction.run($)).rejects.toThrow(
      `HTTP request exceeded timeout of ${testTimeout / 1000}s`,
    )
  }, 5000)

  describe('tests that data is valid JSON', () => {
    // NOTE: caters for existing users that are sending strings in the data field
    it.each(['[1, 2, 3]', 'meep meep'])(
      'should not throw error if data is string',
      async (testData: any) => {
        $.step.parameters.method = 'POST'
        $.step.parameters.data = testData
        $.step.parameters.url = 'http://test.local/endpoint?1234'

        mocks.httpRequest.mockReturnValue('mock response')

        await makeRequestAction.run($).catch((): void => null)
        expect(mocks.httpRequest).toHaveBeenCalledWith(
          expect.objectContaining({
            url: $.step.parameters.url,
            method: $.step.parameters.method,
            data: $.step.parameters.data as any,
            responseType: 'stream',
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

        await makeRequestAction.run($).catch((): void => null)
        expect(mocks.httpRequest).toHaveBeenCalledWith(
          expect.objectContaining({
            url: $.step.parameters.url,
            method: $.step.parameters.method,
            data: $.step.parameters.data as any,
            responseType: 'stream',
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

  describe('escaping variables should maintain original type', () => {
    it.each([
      [true, true],
      [false, false],
      ['true', 'true'],
      [123, 123],
      ['string with "quotes" inside', 'string with \\"quotes\\" inside'],
      ['string without quotes', 'string without quotes'],
      ['{string with braces}', '{string with braces}'],
    ])('should escape variables', (input, expected) => {
      const escaped = makeRequestAction.preprocessVariable('data', input)
      expect(escaped).toBe(expected)
    })
  })
})
