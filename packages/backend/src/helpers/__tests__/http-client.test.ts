import type { IGlobalVariable, IHttpClient } from '@plumber/types'
import type { CreateAxiosDefaults, InternalAxiosRequestConfig } from 'axios'
import axios from 'axios'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import createHttpClient from '../http-client'

const axiosRequestUrlSpy = vi.fn()
const realAxiosCreate = axios.create.bind(axios)

describe('Http client', () => {
  let $: IGlobalVariable

  beforeEach(() => {
    vi.spyOn(axios, 'create').mockImplementation(
      (createConfig?: CreateAxiosDefaults) =>
        realAxiosCreate({
          ...createConfig,
          adapter: async (requestConfig: InternalAxiosRequestConfig) => {
            axiosRequestUrlSpy(requestConfig.url)

            return {
              data: '',
              status: 200,
              statusText: 'OK',
              headers: new axios.AxiosHeaders(),
              config: requestConfig,
            }
          },
        }),
    )

    $ = {
      app: {
        auth: {},
      },
    } as unknown as IGlobalVariable
  })

  afterEach(() => {
    vi.clearAllMocks()
    vi.restoreAllMocks()
  })

  describe('Processes URL path params', () => {
    let http: IHttpClient
    beforeEach(() => {
      http = createHttpClient({
        $,
        baseURL: 'http://localhost',
        beforeRequest: [],
        requestErrorHandler: null,
      })
    })

    it('performs substitution if urlPathParams is provided in request config', async () => {
      await http.get('/drive/:userId/:folderName', {
        urlPathParams: {
          userId: 1234,
          folderName: 'test folder name',
        },
      })

      expect(axiosRequestUrlSpy).toHaveBeenCalledWith(
        '/drive/1234/test%20folder%20name',
      )
    })

    it('is no-op if urlPathParams is not in request config', async () => {
      await http.get('/drive/:userId/:folderName')

      expect(axiosRequestUrlSpy).toHaveBeenCalledWith(
        '/drive/:userId/:folderName',
      )
    })

    // We should never do this, but just in case...
    it('correctly substitutes sequential parameters', async () => {
      await http.get('/drive/:userId-:folderName/', {
        urlPathParams: {
          userId: 1234,
          folderName: 'test folder name',
        },
      })

      expect(axiosRequestUrlSpy).toHaveBeenCalledWith(
        '/drive/1234-test%20folder%20name/',
      )
    })

    it('errors out if there are missing parameters', async () => {
      await expect(
        http.get('/drive/:userId/:folderName', { urlPathParams: {} }),
      ).rejects.toThrow(/Missing value for path parameter .+/)
    })

    it('replaces URL path params before the "beforeRequest" callbacks are invoked', async () => {
      const beforeRequestCallback = vi.fn((_, requestConfig) => requestConfig)

      http = createHttpClient({
        $,
        baseURL: 'http://localhost',
        beforeRequest: [beforeRequestCallback],
        requestErrorHandler: null,
      })

      await http.get('/drive/:userId/:folderName', {
        urlPathParams: {
          userId: 1234,
          folderName: 'test folder name',
        },
      })

      expect(beforeRequestCallback).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ url: '/drive/1234/test%20folder%20name' }),
      )
    })
  })
})
