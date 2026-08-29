import type { IGlobalVariable } from '@plumber/types'
import type { AxiosPromise, CreateAxiosDefaults } from 'axios'
import axios from 'axios'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import apps from '@/apps'
import globalVariable from '@/helpers/global-variable'
import type Connection from '@/models/connection'

import * as formEnv from '../../common/form-env'

const axiosRequestAdapter = vi.fn(async (requestConfig): AxiosPromise => ({
  data: {
    submission: {},
  },
  status: 200,
  statusText: 'OK',
  headers: {},
  config: requestConfig,
}))
const parseFormEnv = vi.fn()
const getApiBaseUrl = vi.fn()
const actualAxiosCreate = axios.create.bind(axios)

describe('FormSG app', () => {
  let $: IGlobalVariable

  beforeEach(async () => {
    vi.spyOn(formEnv, 'parseFormEnv').mockImplementation(parseFormEnv)
    vi.spyOn(formEnv, 'getApiBaseUrl').mockImplementation(getApiBaseUrl)
    vi.spyOn(axios, 'create').mockImplementation(
      (createConfig?: CreateAxiosDefaults) =>
        actualAxiosCreate({
          ...createConfig,
          adapter: axiosRequestAdapter,
        }),
    )

    $ = await globalVariable({
      connection: {
        formattedData: {},
      } as unknown as Connection,
      app: apps.formsg,
    })
  })

  afterEach(() => {
    vi.clearAllMocks()
    vi.restoreAllMocks()
  })

  it('on each outgoing connection, sets the appropriate base API url for the form environment', async () => {
    parseFormEnv.mockReturnValue('staging')
    getApiBaseUrl.mockReturnValue('sample-mock-url')

    await $.http.get('localhost')

    expect(parseFormEnv).toHaveBeenCalled()
    expect(getApiBaseUrl).toHaveBeenCalledWith('staging')
    expect(axiosRequestAdapter).toHaveBeenLastCalledWith(
      expect.objectContaining({
        baseURL: 'sample-mock-url',
      }),
    )
  })
})
