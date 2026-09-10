import { IJSONObject } from '@plumber/types'
import type { AxiosError, AxiosResponse } from 'axios'

import BaseError from './base'

export default class HttpError extends BaseError {
  response: AxiosResponse
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
