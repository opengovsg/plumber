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

import aisayApp from '../..'

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

describe('AISAY request error handlers', () => {
  let http: IHttpClient

  beforeEach(() => {
    const $ = {
      auth: {
        data: {
          clientId: 'some-client-key',
          clientSecret: 'some-client-secret',
        },
      },
    } as unknown as IGlobalVariable
    http = createHttpClient({
      $,
      baseURL: 'http://localhost/mock-aisay-api',
      beforeRequest: [],
      requestErrorHandler: aisayApp.requestErrorHandler,
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('logs an error and jams the entire queue on 429', async () => {
    mockAxiosAdapterToThrowOnce(429, { 'retry-after': 123 })
    await http
      .get('/test-url')
      .then(() => {
        expect.unreachable()
      })
      .catch((error): void => {
        expect(error).toBeInstanceOf(RetriableError)
        expect(error.delayType).toEqual('queue')
        expect(error.message).toEqual('Rate limited by AISAY.')
      })
    expect(mocks.logError).toHaveBeenCalledWith(
      expect.stringContaining('HTTP 429'),
      expect.objectContaining({ event: 'aisay-http-429' }),
    )
  })

  it('logs a warning and throws a RetriableError with default step delay on 503', async () => {
    mockAxiosAdapterToThrowOnce(503)
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
      expect.stringContaining(`HTTP 503`),
      expect.objectContaining({ event: `aisay-http-503` }),
    )
  })

  it('logs a warning and throws a RetriableError with step delay set to retry-after, on receiving 503', async () => {
    mockAxiosAdapterToThrowOnce(503, { 'retry-after': 234 })
    await http
      .get('/test-url')
      .then(() => {
        expect.unreachable()
      })
      .catch((error): void => {
        expect(error).toBeInstanceOf(RetriableError)
        expect(error.delayType).toEqual('step')
        expect(error.delayInMs).toEqual(234000)
      })
    expect(mocks.logWarning).toHaveBeenCalledWith(
      expect.stringContaining(`HTTP 503`),
      expect.objectContaining({ event: `aisay-http-503` }),
    )
  })

  it('logs a warning and still throws a RetriableError with default step delay on 503, if response has invalid retry-after', async () => {
    mockAxiosAdapterToThrowOnce(503, { 'retry-after': 'corrupted' })
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
      expect.objectContaining({ event: 'aisay-http-503' }),
    )
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
