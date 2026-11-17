import { IJSONObject } from '@plumber/types'
import type {
  AxiosError,
  AxiosRequestHeaders,
  AxiosResponse,
  InternalAxiosRequestConfig,
} from 'axios'
import get from 'lodash.get'

import { parseRetryAfterToMs } from '@/helpers/parse-retry-after-to-ms'

import BaseError from './base'

// error.response is only present on AxiosError when the server actually
// replied, so status/statusText/config can genuinely be absent here.
type SanitisedAxiosResponse = Omit<
  AxiosResponse,
  'status' | 'statusText' | 'config' | 'headers'
> & {
  status?: number
  statusText?: string
  // Readonly because `retry` is parsed from it. Change it with `setRetryAfter`.
  headers: Readonly<AxiosResponse['headers']>
  config?: Omit<InternalAxiosRequestConfig, 'headers'> & {
    headers?: AxiosRequestHeaders
  }
}

const RETRY_AFTER_LIMIT_MS = 12 * 60 * 60 * 1000 // 12 hours
const RETRIABLE_ERROR_SUBSTRINGS = ['ETIMEDOUT', 'ECONNRESET']
const RETRIABLE_STATUS_CODES = [
  504,
  429, // Some 429s may not have Retry-After
]

export type HttpRetry =
  | { retriable: true; delayInMs: number | 'default' }
  | {
      retriable: false
      // Set when the server asked for a wait over the limit.
      retryAfterMs?: number
    }

export default class HttpError extends BaseError {
  response: SanitisedAxiosResponse
  code?: string
  resolvedIp?: string
  retry: HttpRetry

  constructor(error: AxiosError) {
    const computedError =
      (error.response?.data as IJSONObject) || (error.message as string)

    super(computedError)

    //
    // Only preserve selected headers to avoid storing sensitive data.
    //
    const headers: Record<string, string> = {}
    if (error.response?.headers?.['retry-after']) {
      headers['retry-after'] = error.response?.headers?.['retry-after']
    }

    // remove unnecessary info and circular reference when logging
    this.response = {
      data: error.response?.data,
      status: error.response?.status,
      statusText: error.response?.statusText,
      config: error.config,
      headers,
    }

    // Pass code along
    this.code = error.code

    // add resolved ip for debugging
    this.resolvedIp = error.request?.socket?.remoteAddress

    // We can strip this completely; all relevant request headers should be in
    // the pipe config.
    if (this.response.config?.headers) {
      this.response.config.headers = undefined
    }

    this.retry = this.parseRetry()
  }

  /**
   * Lets an app's `requestErrorHandler` change the wait (e.g. Telegram adds a
   * buffer) without leaving `retry` stale.
   */
  setRetryAfter(retryAfter: string): void {
    this.response.headers = {
      ...this.response.headers,
      'retry-after': retryAfter,
    }
    this.retry = this.parseRetry()
  }

  private parseRetry(): HttpRetry {
    const retryAfterMs = parseRetryAfterToMs(
      this.response.headers['retry-after'],
    )
    if (retryAfterMs !== null) {
      return retryAfterMs <= RETRY_AFTER_LIMIT_MS
        ? { retriable: true, delayInMs: retryAfterMs }
        : { retriable: false, retryAfterMs }
    }

    const { status } = this.response
    if (status !== undefined && RETRIABLE_STATUS_CODES.includes(status)) {
      return { retriable: true, delayInMs: 'default' }
    }

    const errorString = JSON.stringify(get(this, 'details.error', ''))
    if (
      RETRIABLE_ERROR_SUBSTRINGS.some((substring) =>
        errorString.includes(substring),
      )
    ) {
      return { retriable: true, delayInMs: 'default' }
    }

    return { retriable: false }
  }
}

// axios also sets codes like ERR_CANCELED for requests Plumber failed to send, which are Plumber bugs.
const NETWORK_ERROR_CODES = new Set([
  'ECONNREFUSED',
  'ECONNRESET',
  'ECONNABORTED',
  'ETIMEDOUT',
  'ENOTFOUND',
  'EAI_AGAIN',
  'EPIPE',
  'EHOSTUNREACH',
  'ENETUNREACH',
  'EPROTO',
  'CERT_HAS_EXPIRED',
])

export function isNetworkErrorCode(code: unknown): boolean {
  return typeof code === 'string' && NETWORK_ERROR_CODES.has(code)
}

export function isNetworkError(error: HttpError): boolean {
  return error.response.status === undefined && isNetworkErrorCode(error.code)
}
