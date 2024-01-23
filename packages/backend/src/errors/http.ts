import { IJSONObject } from '@plumber/types'

import type { AxiosError, AxiosResponse } from 'axios'

import BaseError from './base'

export default class HttpError extends BaseError {
  response: AxiosResponse

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

    //
    // Only preserve selected headers to avoid storing sensitive data.
    //

    if (error.response?.headers?.['retry-after']) {
      this.response.headers['retry-after'] =
        error.response?.headers?.['retry-after']
    }

    // Get request headers from pipe config instead.
    this.response.config.headers = undefined
  }
}
