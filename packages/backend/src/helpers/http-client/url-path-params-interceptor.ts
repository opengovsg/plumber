import type { Axios } from 'axios'
import { type ParamMap as UrlPathParams, subst } from 'urlcat'

type AxiosRequestInterceptor = Parameters<
  Axios['interceptors']['request']['use']
>[0]

declare module 'axios' {
  interface AxiosRequestConfig {
    urlPathParams?: UrlPathParams
  }
}

/**
 * An interceptor to enable safe URL path building
 * -----
 * This interceptor provides "SQL prepared statements"-esque functionality to
 * construct URL paths.
 *
 * With this, instead of using JS template literals:
 * ```
 * `/users/${id}/comments/${commentId}`
 * ```
 * where we may forget to escape `id` and `commentId`, we can instead do:
 * ```
 * '/users/:id/comments/:commentId'
 * ```
 * and have this interceptor automatically escape `id` and `commentId` for us.
 *
 * NOTE: Underneath the hood, uses on `urlcat`.
 *
 * -----
 * TO USE
 * -----
 * 1. Provide a template URL path using `$.http`, with parameters specified by a
 *    colon followed by uppercase or lowercase letters.
 * 2. Specify parameters' values in `urlPathParams` in the same request's
 *    config.
 *
 * NOTE: If `urlPathParams` is not provided, this interceptor is a no-op.
 *
 * Example:
 * ```
 * http.get('/{userId}/{folderName}/details', {
 *   urlPathParams: {
 *     userId: 1,
 *     folderId: 'durian pics'
 *   }
 * })
 * ```
 * will yield a GET request to `/1/durian%20pics/details`.
 */
export const urlPathParamsInterceptor: AxiosRequestInterceptor = (config) => {
  const { url, urlPathParams } = config
  if (!urlPathParams) {
    return config
  }

  return {
    ...config,
    url: subst(url, urlPathParams),
  }
}
