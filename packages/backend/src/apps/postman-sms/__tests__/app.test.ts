import type { IActionJobData, IGlobalVariable } from '@plumber/types'

import type { AxiosPromise } from 'axios'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import RetriableError from '@/errors/retriable-error'
import globalVariable from '@/helpers/global-variable'

import { PostmanEnv } from '../common/constants'
import postmanSmsApp from '../'

const MOCK_STEP = {
  id: 'test-flow-id',
  connectionId: 'test-connection-id',
}

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
  getPostmanEnv: vi.fn(() => PostmanEnv.Test),
  authDataParseResult: vi.fn(() => ({
    apiKey: 'test-api-key',
  })),
}))

vi.mock('../auth/schema', () => ({
  authDataSchema: {
    parse: mocks.authDataParseResult,
  },
}))

vi.mock('../common/get-postman-env', () => ({
  default: mocks.getPostmanEnv,
}))

vi.mock('@/models/step', () => ({
  default: {
    query: vi.fn(() => ({
      findById: vi.fn(() => ({
        throwIfNotFound: vi.fn(() => MOCK_STEP),
      })),
    })),
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
    {
      env: PostmanEnv.Test,
      expectedBaseUrl: 'https://test.postman.gov.sg/api/v2',
    },
    {
      env: PostmanEnv.Prod,
      expectedBaseUrl: 'https://postman.gov.sg/api/v2',
    },
  ])('uses the correct API URL', async ({ env, expectedBaseUrl }) => {
    mocks.getPostmanEnv.mockReturnValue(env)

    await $.http.get('localhost')

    expect(mocks.axiosRequestAdapter).toHaveBeenLastCalledWith(
      expect.objectContaining({
        baseURL: expectedBaseUrl,
      }),
    )
  })

  it('adds the API key within the connection for outgoing requests', async () => {
    mocks.authDataParseResult.mockReturnValue({
      apiKey: 'my-api-key',
    })

    await $.http.get('localhost')

    expect(mocks.axiosRequestAdapter).toHaveBeenLastCalledWith(
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer my-api-key',
        }),
      }),
    )
  })

  it('sets the job group to the connection ID', async () => {
    const { id: groupId } = await postmanSmsApp.queue.getGroupConfigForJob({
      stepID: MOCK_STEP.id,
    } as unknown as IActionJobData)

    expect(groupId).toEqual(MOCK_STEP.connectionId)
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
