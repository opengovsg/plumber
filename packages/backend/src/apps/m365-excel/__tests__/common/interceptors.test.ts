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
import createHttpClient, { type IHttpClient } from '@/helpers/http-client'

import m365ExcelApp from '../..'

function mockAxiosAdapterToThrowOnce(
  status: AxiosResponse['status'],
  headers?: AxiosResponse['headers'],
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
        config,
      } as unknown as AxiosResponse,
    )
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

describe('M365 interceptors', () => {
  let http: IHttpClient

  beforeEach(() => {
    const $ = {
      auth: {
        data: {
          tenantKey: 'test-tenant',
        },
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

  describe('Request error handlers', () => {
    it('logs a warning and throws a retriable error on 503 with default delay, if response does not have retry-after', async () => {
      mockAxiosAdapterToThrowOnce(503)
      await http
        .get('/test-url')
        .then(() => {
          expect.unreachable()
        })
        .catch((error): void => {
          expect(error).toBeInstanceOf(RetriableError)
          expect(error.delayInMs).toEqual(DEFAULT_DELAY_MS)
        })
      expect(mocks.logWarning).toHaveBeenCalledWith(
        expect.stringContaining('HTTP 503'),
        expect.objectContaining({ event: 'm365-http-503' }),
      )
    })

    it('logs a warning and throws a retriable error on 503 with delay set to retry-after', async () => {
      mockAxiosAdapterToThrowOnce(503, { 'retry-after': 123 })
      await http
        .get('/test-url')
        .then(() => {
          expect.unreachable()
        })
        .catch((error): void => {
          expect(error).toBeInstanceOf(RetriableError)
          expect(error.delayInMs).toEqual(123000)
        })
      expect(mocks.logWarning).toHaveBeenCalledWith(
        expect.stringContaining('HTTP 503'),
        expect.objectContaining({ event: 'm365-http-503' }),
      )
    })

    it('logs a warning and still throws a retriable error on 503 with default delay, if response has invalid retry-after', async () => {
      mockAxiosAdapterToThrowOnce(503, { 'retry-after': 'corruped' })
      await http
        .get('/test-url')
        .then(() => {
          expect.unreachable()
        })
        .catch((error): void => {
          expect(error).toBeInstanceOf(RetriableError)
          expect(error.delayInMs).toEqual(DEFAULT_DELAY_MS)
        })
      expect(mocks.logWarning).toHaveBeenCalledWith(
        expect.stringContaining('HTTP 503'),
        expect.objectContaining({ event: 'm365-http-503' }),
      )
    })

    it('logs an error and throws a non-retriable error on 429 from non-excel endpoint', async () => {
      mockAxiosAdapterToThrowOnce(429, { 'retry-after': 123 })
      await http
        .get('/test-url')
        .then(() => {
          expect.unreachable()
        })
        .catch((error): void => {
          expect(error).toBeInstanceOf(Error)
          expect(error).not.toBeInstanceOf(RetriableError)
          expect(error.message).toEqual('Rate limited by Microsoft Graph.')
        })
      expect(mocks.logError).toHaveBeenCalledWith(
        expect.stringContaining('HTTP 429'),
        expect.objectContaining({ event: 'm365-http-429' }),
      )
    })

    it('throws a retriable error on 429 from Excel endpoint', async () => {
      mockAxiosAdapterToThrowOnce(429, { 'retry-after': 123 })
      await http
        .get("/test-url/workbook/cell(address='A1')")
        .then(() => {
          expect.unreachable()
        })
        .catch((error): void => {
          expect(error).toBeInstanceOf(RetriableError)
          expect(error.delayInMs).toEqual(123000)
          expect(error.message).toEqual('Retrying HTTP 429 from Excel endpoint')
        })
    })

    it('logs an error and throws a non-retriable error on 509', async () => {
      mockAxiosAdapterToThrowOnce(509)
      await http
        .get('/test-url')
        .then(() => {
          expect.unreachable()
        })
        .catch((error): void => {
          expect(error).toBeInstanceOf(Error)
          expect(error).not.toBeInstanceOf(RetriableError)
          expect(error.message).toEqual('Bandwidth limited by Microsoft Graph.')
        })
      expect(mocks.logError).toHaveBeenCalledWith(
        expect.stringContaining('HTTP 509'),
        expect.objectContaining({ event: 'm365-http-509' }),
      )
    })

    it('throws HTTP error on other non-successful codes', async () => {
      mockAxiosAdapterToThrowOnce(500, { 'retry-after': 123 })
      await expect(http.get('/test-url')).rejects.toThrow(HttpError)
    })

    it('does not throw error if response is success', async () => {
      await expect(http.get('/test-url')).resolves.toEqual(
        expect.objectContaining({ data: 'test-data', status: 200 }),
      )
    })
  })
})
