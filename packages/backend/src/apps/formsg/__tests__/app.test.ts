import type { IGlobalVariable } from '@plumber/types'

import type { AxiosPromise } from 'axios'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import globalVariable from '@/helpers/global-variable'
import type Connection from '@/models/connection'

import formSgApp from '../'

const mocks = vi.hoisted(() => ({
  axiosRequestAdapter: vi.fn(
    async (requestConfig): AxiosPromise => ({
      data: {
        submission: {},
      },
      status: 200,
      statusText: 'OK',
      headers: {},
      config: requestConfig,
    }),
  ),
  parseFormEnv: vi.fn(),
  getApiBaseUrl: vi.fn(),
}))

vi.mock('../common/form-env', () => ({
  parseFormEnv: mocks.parseFormEnv,
  getApiBaseUrl: mocks.getApiBaseUrl,
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

describe('FormSG app', () => {
  let $: IGlobalVariable

  beforeEach(async () => {
    $ = await globalVariable({
      connection: {
        formattedData: {},
      } as unknown as Connection,
      app: formSgApp,
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('on each outgoing connection, sets the appropriate base API url for the form environment', async () => {
    mocks.parseFormEnv.mockReturnValue('staging')
    mocks.getApiBaseUrl.mockReturnValue('sample-mock-url')

    await $.http.get('localhost')

    expect(mocks.parseFormEnv).toBeCalled()
    expect(mocks.getApiBaseUrl).toBeCalledWith('staging')
    expect(mocks.axiosRequestAdapter).toHaveBeenLastCalledWith(
      expect.objectContaining({
        baseURL: 'sample-mock-url',
      }),
    )
  })
})
