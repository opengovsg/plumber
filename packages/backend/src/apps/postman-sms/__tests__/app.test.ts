import type { IGlobalVariable } from '@plumber/types'

import type { AxiosPromise } from 'axios'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import RetriableError from '@/errors/retriable-error'
import globalVariable from '@/helpers/global-variable'

import postmanSmsApp from '../'

const mocks = vi.hoisted(() => ({
  axiosRequestAdapter: vi.fn(
    async (requestConfig): AxiosPromise => ({
      data: {
        createdAt: '2024-01-29T17:39:35.574+08:00',
        id: 'test-message-id',
      },
      status: 200,
      statusText: 'OK',
      headers: {},
      config: requestConfig,
    }),
  ),
  appConfig: {
    isProd: false,
  },
}))

vi.mock('@/config/app', () => ({ default: mocks.appConfig }))

vi.mock('@/config/app-env-vars/postman-sms', () => ({
  postmanSmsConfig: {
    defaultCampaignId: 'test-campaign-id',
    defaultApiKey: 'test-key',
    qpsLimitPerCampaign: 3,
  },
}))

vi.mock('axios', async (importOriginal) => {
  const actualAxios = await importOriginal<typeof import('axios')>()
  const mockCreate: typeof actualAxios.default.create = (createConfig) =>
    actualAxios.default.create({
      ...createConfig,
      adapter: mocks.axiosRequestAdapter,
    })

  return {
    default: {
      ...actualAxios.default,
      create: mockCreate,
    },
  }
})

describe('Postman SMS app', () => {
  let $: IGlobalVariable

  beforeEach(async () => {
    $ = await globalVariable({
      connection: null,
      app: postmanSmsApp,
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it.each([
    { isProd: false, expectedBaseUrl: 'https://test.postman.gov.sg/api/v2' },
    { isProd: true, expectedBaseUrl: 'https://postman.gov.sg/api/v2' },
  ])('uses the correct API URL', async ({ isProd, expectedBaseUrl }) => {
    mocks.appConfig.isProd = isProd
    await $.http.get('localhost')

    expect(mocks.axiosRequestAdapter).toHaveBeenLastCalledWith(
      expect.objectContaining({
        baseURL: expectedBaseUrl,
      }),
    )
  })

  it('adds our default postman API key for outgoing requests', async () => {
    await $.http.get('localhost')

    expect(mocks.axiosRequestAdapter).toHaveBeenLastCalledWith(
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer test-key',
        }),
      }),
    )
  })

  it('Throws a group delayed RetriableError if any Postman call responds with a HTTP 429', async () => {
    mocks.axiosRequestAdapter.mockImplementation(async (requestConfig) => ({
      data: {},
      status: 429,
      statusText: 'Too Many Requests',
      headers: {
        'retry-after': 42,
      },
      config: requestConfig,
    }))

    try {
      await $.http.get('localhost')
    } catch (error) {
      if (!(error instanceof RetriableError)) {
        expect.unreachable()
      }
      expect(error.delayType).toEqual('group')
      expect(error.delayInMs).toEqual(42000)
    }
  })

  it('Throws a group delayed RetriableError with default delay if any Postman call responds with a HTTP 429 without retry-after', async () => {
    mocks.axiosRequestAdapter.mockResolvedValue({
      data: {},
      status: 429,
      statusText: 'Too Many Requests',
      headers: {},
      config: {} as any,
    })

    try {
      await $.http.get('localhost')
    } catch (error) {
      if (!(error instanceof RetriableError)) {
        expect.unreachable()
      }
      expect(error.delayType).toEqual('group')
      expect(error.delayInMs).toEqual('default')
    }
  })
})
