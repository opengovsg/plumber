// Avoid cyclic imports when importing m365ExcelApp
import '@/apps'

import type { IGlobalVariable } from '@plumber/types'

import {
  AxiosError,
  type AxiosPromise,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from 'axios'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import HttpError from '@/errors/http'
import RetriableError, { DEFAULT_DELAY_MS } from '@/errors/retriable-error'
import StepError from '@/errors/step'
import createHttpClient, { type IHttpClient } from '@/helpers/http-client'

import m365ExcelApp from '../..'
import { EXCEL_504_MAX_ATTEMPTS } from '../../common/interceptors/request-error-handler'

function mockAxiosAdapterToThrowOnce(
  status: AxiosResponse['status'],
  headers?: AxiosResponse['headers'],
  data?: AxiosResponse['data'],
): void {
  mocks.axiosAdapter.mockImplementationOnce((config) => {
    throw new AxiosError(
      'Request failed',
      AxiosError.ERR_BAD_RESPONSE,
      config,
      null,
      {
        status,
        headers,
        data,
        config,
      } as unknown as AxiosResponse,
    )
  })
}

function mockAxiosAdapterToThrowNetworkErrorOnce(code: string): void {
  mocks.axiosAdapter.mockImplementationOnce((config) => {
    throw new AxiosError('Network error', code, config, null, undefined)
  })
}

const mocks = vi.hoisted(() => ({
  axiosAdapter: vi.fn(
    async (config: InternalAxiosRequestConfig): AxiosPromise => ({
      data: 'test-data',
      status: 200,
      statusText: 'OK',
      headers: {},
      config,
    }),
  ),
  logWarning: vi.fn(),
  logError: vi.fn(),
}))

vi.mock('axios', async (importOriginal) => {
  const actualAxios = await importOriginal<typeof import('axios')>()
  const mockCreate: typeof actualAxios.default.create = (createConfig) =>
    actualAxios.default.create({
      ...createConfig,
      adapter: mocks.axiosAdapter,
    })

  return {
    ...actualAxios,
    default: {
      ...actualAxios.default,
      create: mockCreate,
    },
  }
})

vi.mock('@/helpers/logger', () => ({
  default: {
    warn: mocks.logWarning,
    error: mocks.logError,
  },
}))

describe('M365 request error handlers', () => {
  let http: IHttpClient

  beforeEach(() => {
    const $ = {
      auth: {
        data: {
          tenantKey: 'test-tenant',
        },
      },
      step: {
        position: 1,
      },
      app: {
        name: 'M365 Excel',
      },
    } as unknown as IGlobalVariable
    http = createHttpClient({
      $,
      baseURL: 'http://localhost/mock-m365-graph-api',
      beforeRequest: [],
      requestErrorHandler: m365ExcelApp.requestErrorHandler,
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('logs an error and throws a RetriableError with default step delay on the intermittent 404 "Invalid version" blip', async () => {
    mockAxiosAdapterToThrowOnce(404, undefined, {
      error: { code: 'ResourceNotFound', message: 'Invalid version: error' },
    })
    await http
      .get('/test-url')
      .then(() => {
        expect.unreachable()
      })
      .catch((error): void => {
        expect(error).toBeInstanceOf(RetriableError)
        expect(error.delayType).toEqual('step')
        expect(error.delayInMs).toEqual(DEFAULT_DELAY_MS)
        expect(error.message).toEqual('Retrying HTTP 404 from M365 Excel')
      })
    expect(mocks.logError).toHaveBeenCalledWith(
      expect.stringContaining('HTTP 404'),
      expect.objectContaining({ event: 'm365-http-404-invalid-version' }),
    )
  })

  it.each([
    {
      name: 'the error code does not match',
      data: {
        error: { code: 'ItemNotFound', message: 'Invalid version: error' },
      },
    },
    {
      name: 'the error message does not match',
      data: {
        error: { code: 'ResourceNotFound', message: 'Item not found' },
      },
    },
    {
      name: 'the body is not a parseable Graph API error',
      data: { unexpected: 'body' },
    },
  ])(
    'rethrows the original HttpError on a 404 when $name',
    async ({ data }) => {
      mockAxiosAdapterToThrowOnce(404, undefined, data)
      await expect(http.get('/test-url')).rejects.toThrow(HttpError)
      expect(mocks.logError).not.toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ event: 'm365-http-404-invalid-version' }),
      )
    },
  )

  it.each([500, 502, 503])(
    'logs a warning and throws a RetriableError with default step delay on %s',
    async (status) => {
      mockAxiosAdapterToThrowOnce(status)
      await http
        .get('/test-url')
        .then(() => {
          expect.unreachable()
        })
        .catch((error): void => {
          expect(error).toBeInstanceOf(RetriableError)
          expect(error.delayType).toEqual('step')
          expect(error.delayInMs).toEqual(DEFAULT_DELAY_MS)
        })
      expect(mocks.logWarning).toHaveBeenCalledWith(
        expect.stringContaining(`HTTP ${status}`),
        expect.objectContaining({ event: `m365-http-${status}` }),
      )
    },
  )

  it('logs a warning and throws a RetriableError with step delay set to retry-after, on receiving 503', async () => {
    mockAxiosAdapterToThrowOnce(503, { 'retry-after': 123 })
    await http
      .get('/test-url')
      .then(() => {
        expect.unreachable()
      })
      .catch((error): void => {
        expect(error).toBeInstanceOf(RetriableError)
        expect(error.delayType).toEqual('step')
        expect(error.delayInMs).toEqual(123000)
      })
    expect(mocks.logWarning).toHaveBeenCalledWith(
      expect.stringContaining('HTTP 503'),
      expect.objectContaining({ event: 'm365-http-503' }),
    )
  })

  it('logs a warning and still throws a RetriableError with default step delay on 503, if response has invalid retry-after', async () => {
    mockAxiosAdapterToThrowOnce(503, { 'retry-after': 'corruped' })
    await http
      .get('/test-url')
      .then(() => {
        expect.unreachable()
      })
      .catch((error): void => {
        expect(error).toBeInstanceOf(RetriableError)
        expect(error.delayType).toEqual('step')
        expect(error.delayInMs).toEqual(DEFAULT_DELAY_MS)
      })
    expect(mocks.logWarning).toHaveBeenCalledWith(
      expect.stringContaining('HTTP 503'),
      expect.objectContaining({ event: 'm365-http-503' }),
    )
  })

  it('logs an error and jams the entire queue on 429 from non-excel endpoint', async () => {
    mockAxiosAdapterToThrowOnce(429, { 'retry-after': 123 })
    await http
      .get('/test-url')
      .then(() => {
        expect.unreachable()
      })
      .catch((error): void => {
        expect(error).toBeInstanceOf(RetriableError)
        expect(error.delayType).toEqual('queue')
        expect(error.message).toEqual('Rate limited by Microsoft Graph.')
      })
    expect(mocks.logError).toHaveBeenCalledWith(
      expect.stringContaining('HTTP 429'),
      expect.objectContaining({ event: 'm365-http-429' }),
    )
  })

  it('throws a RetriableError with group delay set to Retry-After, on 429 from Excel endpoint', async () => {
    mockAxiosAdapterToThrowOnce(429, { 'retry-after': 123 })
    await http
      .get("/test-url/workbook/cell(address='A1')")
      .then(() => {
        expect.unreachable()
      })
      .catch((error): void => {
        expect(error).toBeInstanceOf(RetriableError)
        expect(error.delayInMs).toEqual(123000)
        expect(error.delayType).toEqual('group')
        expect(error.message).toEqual('Retrying HTTP 429 from Excel endpoint')
      })
  })

  it('logs an error and jams the entire queue on 509', async () => {
    mockAxiosAdapterToThrowOnce(509)
    await http
      .get('/test-url')
      .then(() => {
        expect.unreachable()
      })
      .catch((error): void => {
        expect(error).toBeInstanceOf(RetriableError)
        expect(error.delayType).toEqual('queue')
        expect(error.message).toEqual('Bandwidth limited by Microsoft Graph.')
      })
    expect(mocks.logError).toHaveBeenCalledWith(
      expect.stringContaining('HTTP 509'),
      expect.objectContaining({ event: 'm365-http-509' }),
    )
  })

  it('throws RetriableError with custom max attempts on 504 (live run)', async () => {
    // Default $ doesn't have execution.testRun, so this is the live run path
    mockAxiosAdapterToThrowOnce(504)
    await http
      .get('/test-url')
      .then(() => {
        expect.unreachable()
      })
      .catch((error): void => {
        expect(error).toBeInstanceOf(RetriableError)
        expect(error.delayType).toEqual('step')
        expect(error.delayInMs).toEqual(DEFAULT_DELAY_MS)
        expect(error.maxAttempts).toEqual(EXCEL_504_MAX_ATTEMPTS)
        // Message contains the user-friendly error (will be saved as errorDetails)
        expect(error.message).toContain('Excel request timed out')
      })
    expect(mocks.logWarning).toHaveBeenCalledWith(
      expect.stringContaining('HTTP 504'),
      expect.objectContaining({ event: 'm365-http-504' }),
    )
  })

  it('throws StepError immediately on 504 (test run)', async () => {
    // Create http client with testRun: true
    const $testRun = {
      auth: {
        data: {
          tenantKey: 'test-tenant',
        },
      },
      step: {
        position: 1,
      },
      app: {
        name: 'M365 Excel',
      },
      execution: {
        testRun: true,
      },
    } as unknown as IGlobalVariable
    const httpTestRun = createHttpClient({
      $: $testRun,
      baseURL: 'http://localhost/mock-m365-graph-api',
      beforeRequest: [],
      requestErrorHandler: m365ExcelApp.requestErrorHandler,
    })

    mockAxiosAdapterToThrowOnce(504)
    await httpTestRun
      .get('/test-url')
      .then(() => {
        expect.unreachable()
      })
      .catch((error): void => {
        expect(error).toBeInstanceOf(StepError)
        expect(error.message).toContain('Excel request timed out')
      })
    expect(mocks.logWarning).toHaveBeenCalledWith(
      expect.stringContaining('HTTP 504'),
      expect.objectContaining({ event: 'm365-http-504' }),
    )
  })

  it('throws a RetriableError with default step delay on ETIMEDOUT', async () => {
    mockAxiosAdapterToThrowNetworkErrorOnce('ETIMEDOUT')
    await expect(http.get('/test-url')).rejects.toThrow(RetriableError)
  })

  it('throws HTTP error on other non-successful codes', async () => {
    mockAxiosAdapterToThrowOnce(501, { 'retry-after': 123 })
    await expect(http.get('/test-url')).rejects.toThrow(HttpError)
  })

  it('does not throw error if response is success', async () => {
    await expect(http.get('/test-url')).resolves.toEqual(
      expect.objectContaining({ data: 'test-data', status: 200 }),
    )
  })
})
