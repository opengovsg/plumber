import axios, { AxiosRequestConfig } from 'axios'

export { AxiosInstance as IHttpClient } from 'axios'
import { IHttpClientParams } from '@plumber/types'

import { URL } from 'url'

import HttpError from '@/errors/http'

const removeBaseUrlForAbsoluteUrls = (
  requestConfig: AxiosRequestConfig,
): AxiosRequestConfig => {
  try {
    const url = new URL(requestConfig.url)
    requestConfig.baseURL = url.origin
    requestConfig.url = url.pathname + url.search

    return requestConfig
  } catch {
    return requestConfig
  }
}

export default function createHttpClient({
  $,
  baseURL,
  beforeRequest = [],
}: IHttpClientParams) {
  const instance = axios.create({
    baseURL,
  })

  instance.interceptors.request.use(
    async (requestConfig: AxiosRequestConfig): Promise<AxiosRequestConfig> => {
      let newRequestConfig = removeBaseUrlForAbsoluteUrls(requestConfig)

      // Intentionally serial as each callback works on result of previous one.
      for (const callback of beforeRequest) {
        newRequestConfig = await callback($, newRequestConfig)
      }

      return newRequestConfig
    },
  )

  instance.interceptors.response.use(
    (response) => response,
    async (error) => {
      // This handles system errors like ECONNREFUSED, which don't have a
      // response body.
      if (!error.response) {
        throw new HttpError(error)
      }

      const { config } = error
      const { status } = error.response

      if (
        (status === 401 || status === 403) &&
        $.app.auth.refreshToken &&
        !$.app.auth.isRefreshTokenRequested
      ) {
        $.app.auth.isRefreshTokenRequested = true
        await $.app.auth.refreshToken($)

        // retry the previous request before the expired token error
        const newResponse = await instance.request(config)
        $.app.auth.isRefreshTokenRequested = false

        return newResponse
      }

      throw new HttpError(error)
    },
  )

  return instance
}
