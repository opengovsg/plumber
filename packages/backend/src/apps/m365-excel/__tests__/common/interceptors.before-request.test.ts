// Avoid cyclic imports when importing m365ExcelApp
import '@/apps'
import type { IGlobalVariable } from '@plumber/types'
import {
  type AxiosPromise,
  type CreateAxiosDefaults,
  type InternalAxiosRequestConfig,
} from 'axios'
import axios from 'axios'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import * as m365Config from '@/config/app-env-vars/m365'
import createHttpClient, { type IHttpClient } from '@/helpers/http-client'
import logger from '@/helpers/logger'

import m365ExcelApp from '../..'
import { MS_GRAPH_OAUTH_BASE_URL } from '../../common/constants'
import * as tokenCache from '../../common/oauth/token-cache'

const axiosRequestConfigSpy = vi.fn()
const getAccessToken = vi.fn(() => 'test-access-token')
const logInfo = vi.fn()
const actualAxiosCreate = axios.create.bind(axios)

describe('M365 before request interceptors', () => {
  let http: IHttpClient

  beforeEach(() => {
    vi.spyOn(axios, 'create').mockImplementation(
      (createConfig?: CreateAxiosDefaults) =>
        actualAxiosCreate({
          ...createConfig,
          adapter: async (config: InternalAxiosRequestConfig): AxiosPromise => {
            axiosRequestConfigSpy(config)
            return {
              data: 'test-data',
              status: 200,
              statusText: 'OK',
              headers: {},
              config,
            }
          },
        }),
    )
    vi.spyOn(logger, 'info').mockImplementation(logInfo)
    vi.spyOn(m365Config, 'M365_EXCEL_INTERVAL_BETWEEN_ACTIONS_MS', 'get').mockReturnValue(
      1000,
    )
    vi.spyOn(m365Config, 'isM365TenantKey').mockReturnValue(true)
    vi.spyOn(tokenCache, 'getAccessToken').mockImplementation(getAccessToken)

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
    vi.clearAllMocks()
    vi.restoreAllMocks()
  })

  it('logs Graph API usage', async () => {
    await http.get('/test-url')

    expect(logInfo).toHaveBeenCalledWith('Making request to MS Graph', {
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

    expect(axiosRequestConfigSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer test-access-token',
        }),
      }),
    )
  })

  it('does not add auth token for non-OAuth requests', async () => {
    await http.get('/re-auth', { baseURL: MS_GRAPH_OAUTH_BASE_URL })
    expect(getAccessToken).not.toHaveBeenCalled()
  })
})
