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
      headers: error.response?.headers,
      config: error.config,
    }
  }
}
