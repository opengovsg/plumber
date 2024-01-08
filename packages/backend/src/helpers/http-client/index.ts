import axios, { InternalAxiosRequestConfig } from 'axios'

export { AxiosInstance as IHttpClient } from 'axios'
import { IHttpClientParams } from '@plumber/types'

import { URL } from 'url'

import HttpError from '@/errors/http'
import RetriableError from '@/errors/retriable-error'

const removeBaseUrlForAbsoluteUrls = (
  requestConfig: InternalAxiosRequestConfig,
): InternalAxiosRequestConfig => {
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
  beforeRequest,
  requestErrorHandler,
}: IHttpClientParams) {
  const instance = axios.create({
    baseURL,
  })

  instance.interceptors.request.use(
    async (
      requestConfig: InternalAxiosRequestConfig,
    ): Promise<InternalAxiosRequestConfig> => {
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
      // EDGE CASE: We allow actions / triggers to throw RetriableError, and
      // some of them may choose to throw from beforeRequest. If this happens,
      // Axios will still process the error through this response interceptor.
      //
      // Since RetriableError is supposed to be passed directly through to
      // BullMQ, we special case it here instead of converting it to HttpError.
      //
      // Note that we still want to convert _other_ error types (even if
      // they're not axios errors!) to HttpError; this helps prevent accidental
      // sensitive data leakage via error objects in our logs.
      if (error instanceof RetriableError) {
        throw error
      }

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
  // We use a separate interceptor for requestErrorHandler to allow the above
  // HttpError inteceptor to throw early.
  instance.interceptors.response.use(
    (response) => response,
    async (error) => {
      if (!requestErrorHandler) {
        throw error
      }

      // Passthrough other errors... although other errors should really only be
      // RetriableError.
      if (!(error instanceof HttpError)) {
        throw error
      }

      await requestErrorHandler($, error)

      throw error
    },
  )

  return instance
}
