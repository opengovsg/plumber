// Avoid cyclic imports when importing m365ExcelApp
import '@/apps'

import type { IGlobalVariable } from '@plumber/types'

import { type AxiosPromise, type InternalAxiosRequestConfig } from 'axios'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import createHttpClient, { type IHttpClient } from '@/helpers/http-client'

import m365ExcelApp from '../..'
import { MS_GRAPH_OAUTH_BASE_URL } from '../../common/constants'

const mocks = vi.hoisted(() => ({
  axiosRequestConfigSpy: vi.fn(),
  getAccessToken: vi.fn(() => 'test-access-token'),
  checkGraphApiRateLimit: vi.fn(),
  logInfo: vi.fn(),
}))

vi.mock('axios', async (importOriginal) => {
  const actualAxios = await importOriginal<typeof import('axios')>()
  const mockCreate: typeof actualAxios.default.create = (createConfig) =>
    actualAxios.default.create({
      ...createConfig,
      adapter: async (config: InternalAxiosRequestConfig): AxiosPromise => {
        mocks.axiosRequestConfigSpy(config)
        return {
          data: 'test-data',
          status: 200,
          statusText: 'OK',
          headers: {},
          config,
        }
      },
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
    info: mocks.logInfo,
  },
}))

vi.mock('@/config/app-env-vars/m365', () => ({
  isM365TenantKey: vi.fn(() => true),
}))

vi.mock('../../common/oauth/token-cache', () => ({
  getAccessToken: mocks.getAccessToken,
}))

vi.mock('../../common/rate-limiter', () => ({
  checkGraphApiRateLimit: mocks.checkGraphApiRateLimit,
}))

describe('M365 before request interceptors', () => {
  let http: IHttpClient

  beforeEach(() => {
    const $ = {
      auth: {
        data: {
          tenantKey: 'test-tenant',
        },
      },
      flow: {
        id: 'test-flow-id',
      },
      step: {
        id: 'test-step-id',
      },
      execution: {
        id: 'test-exec-id',
      },
    } as unknown as IGlobalVariable
    http = createHttpClient({
      $,
      baseURL: 'http://localhost/mock-m365-graph-api',
      beforeRequest: m365ExcelApp.beforeRequest,
      requestErrorHandler: null,
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('logs Graph API usage', async () => {
    await http.get('/test-url')

    expect(mocks.logInfo).toHaveBeenCalledWith('Making request to MS Graph', {
      event: 'm365-ms-graph-request',
      tenant: 'test-tenant',
      baseUrl: 'http://localhost/mock-m365-graph-api',
      urlPath: '/test-url',
      flowId: 'test-flow-id',
      stepId: 'test-step-id',
      executionId: 'test-exec-id',
    })
  })

  it('adds auth token for non-OAuth requests', async () => {
    await http.get('/test-url')

    expect(mocks.axiosRequestConfigSpy).toBeCalledWith(
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer test-access-token',
        }),
      }),
    )
  })

  it('does not add auth token for non-OAuth requests', async () => {
    await http.get('/re-auth', { baseURL: MS_GRAPH_OAUTH_BASE_URL })
    expect(mocks.getAccessToken).not.toBeCalled()
  })

  it.each([
    { url: '/test-url' },
    { url: '/reauth', config: { baseURL: MS_GRAPH_OAUTH_BASE_URL } },
  ])(
    'checks against the rate limiter for that tenant for every request',
    async ({ url, config }) => {
      await http.get(url, config)
      expect(mocks.checkGraphApiRateLimit).toBeCalledWith(
        expect.anything(),
        'test-tenant',
        url,
      )
    },
  )
})
