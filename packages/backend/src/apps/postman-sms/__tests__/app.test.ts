import type { IActionJobData, IGlobalVariable } from '@plumber/types'
import type { AxiosPromise, CreateAxiosDefaults } from 'axios'
import axios from 'axios'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import RetriableError from '@/errors/retriable-error'
import globalVariable from '@/helpers/global-variable'
import Step from '@/models/step'
import { createStepQueryChain, spyOnStepQuery } from '@/test/spy-on-step-query'

import postmanSmsApp from '../'
import * as authSchema from '../auth/schema'
import { PostmanEnv } from '../common/constants'
import * as getPostmanEnvModule from '../common/get-postman-env'

const MOCK_STEP = {
  id: 'test-flow-id',
  connectionId: 'test-connection-id',
}

const axiosRequestAdapter = vi.fn(async (requestConfig): AxiosPromise => ({
  data: {
    createdAt: '2024-01-29T17:39:35.574+08:00',
    id: 'test-message-id',
  },
  status: 200,
  statusText: 'OK',
  headers: {},
  config: requestConfig,
}))
const getPostmanEnv = vi.fn(() => PostmanEnv.Test)
const authDataParseResult = vi.fn(() => ({
  apiKey: 'test-api-key',
}))
const actualAxiosCreate = axios.create.bind(axios)

describe('Postman SMS app', () => {
  let $: IGlobalVariable

  beforeEach(async () => {
    vi.spyOn(getPostmanEnvModule, 'default').mockImplementation(
      getPostmanEnv as never,
    )
    vi.spyOn(authSchema.authDataSchema, 'parse').mockImplementation(
      authDataParseResult as never,
    )
    vi.spyOn(axios, 'create').mockImplementation(((
      createConfig?: CreateAxiosDefaults,
    ) =>
      actualAxiosCreate({
        ...createConfig,
        adapter: axiosRequestAdapter,
      })) as never)
    spyOnStepQuery(
      createStepQueryChain({
        findById: vi.fn(() => ({
          throwIfNotFound: vi.fn(() => MOCK_STEP),
        })),
      }),
    )

    $ = await globalVariable({
      connection: null,
      app: postmanSmsApp,
    })
  })

  afterEach(() => {
    vi.clearAllMocks()
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
    getPostmanEnv.mockReturnValue(env)

    await $.http.get('localhost')

    expect(axiosRequestAdapter).toHaveBeenLastCalledWith(
      expect.objectContaining({
        baseURL: expectedBaseUrl,
      }),
    )
  })

  it('adds the API key within the connection for outgoing requests', async () => {
    authDataParseResult.mockReturnValue({
      apiKey: 'my-api-key',
    })

    await $.http.get('localhost')

    expect(axiosRequestAdapter).toHaveBeenLastCalledWith(
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
    expect(Step.query).toHaveBeenCalled()
  })

  it('Throws a group delayed RetriableError if any Postman call responds with a HTTP 429', async () => {
    axiosRequestAdapter.mockImplementation(async (requestConfig) => ({
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
    axiosRequestAdapter.mockResolvedValue({
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
