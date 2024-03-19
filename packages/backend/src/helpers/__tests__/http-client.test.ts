import type { IGlobalVariable, IHttpClient } from '@plumber/types'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import createHttpClient from '../http-client'

const mocks = vi.hoisted(() => ({
  axiosRequestUrlSpy: vi.fn(),
}))

vi.mock('axios', async (importOriginal) => {
  const actualAxios = await importOriginal<typeof import('axios')>()
  const mockCreate: typeof actualAxios.default.create = (createConfig) =>
    actualAxios.default.create({
      ...createConfig,
      adapter: async (requestConfig) => {
        mocks.axiosRequestUrlSpy(requestConfig.url)

        return {
          data: '',
          status: 200,
          statusText: 'OK',
          headers: new actualAxios.AxiosHeaders(),
          config: requestConfig,
        }
      },
    })

  return {
    default: {
      ...actualAxios.default,
      create: mockCreate,
    },
  }
})

describe('Http client', () => {
  let $: IGlobalVariable
  beforeEach(() => {
    $ = {
      app: {
        auth: {},
      },
    } as unknown as IGlobalVariable
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('URL path params interceptor', () => {
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

      expect(mocks.axiosRequestUrlSpy).toHaveBeenCalledWith(
        '/drive/1234/test%20folder%20name',
      )
    })

    it('is no-op if urlPathParams is not in request config', async () => {
      await http.get('/drive/:userId/:folderName')

      expect(mocks.axiosRequestUrlSpy).toHaveBeenCalledWith(
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

      expect(mocks.axiosRequestUrlSpy).toHaveBeenCalledWith(
        '/drive/1234-test%20folder%20name/',
      )
    })

    it('errors out if there are missing parameters', async () => {
      expect(
        http.get('/drive/:userId/:folderName', { urlPathParams: {} }),
      ).rejects.toThrow(/Missing value for path parameter .+/)
    })
  })
})
