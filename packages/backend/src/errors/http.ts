import { IJSONObject } from '@plumber/types'
import type {
  AxiosError,
  AxiosRequestHeaders,
  AxiosResponse,
  InternalAxiosRequestConfig,
} from 'axios'

import BaseError from './base'

// error.response is only present on AxiosError when the server actually
// replied, so status/statusText/config can genuinely be absent here.
type SanitisedAxiosResponse = Omit<
  AxiosResponse,
  'status' | 'statusText' | 'config'
> & {
  status?: number
  statusText?: string
  config?: Omit<InternalAxiosRequestConfig, 'headers'> & {
    headers?: AxiosRequestHeaders
  }
}

export default class HttpError extends BaseError {
  response: SanitisedAxiosResponse
  code?: string
  resolvedIp?: string

  constructor(error: AxiosError) {
    const computedError =
      (error.response?.data as IJSONObject) || (error.message as string)

    super(computedError)

    // remove unnecessary info and circular reference when logging
    this.response = {
      data: error.response?.data,
      status: error.response?.status,
      statusText: error.response?.statusText,
      config: error.config,
      headers: {},
    }

    // Pass code along
    this.code = error.code

    // add resolved ip for debugging
    this.resolvedIp = error.request?.socket?.remoteAddress

    //
    // Only preserve selected headers to avoid storing sensitive data.
    //

    if (error.response?.headers?.['retry-after']) {
      this.response.headers['retry-after'] =
        error.response?.headers?.['retry-after']
    }

    // We can strip this completely; all relevant request headers should be in
    // the pipe config.
    if (this.response.config?.headers) {
      this.response.config.headers = undefined
    }
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

export function isNetworkError(error: HttpError): boolean {
  return (
    error.response.status === undefined &&
    NETWORK_ERROR_CODES.has(error.code ?? '')
  )
}
