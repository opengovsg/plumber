import { AxiosInstance } from 'axios'

import HttpError from '@/errors/http'
import logger from '@/helpers/logger'

import { streamResponse } from './stream-response'

const addInterceptors = (httpClient: AxiosInstance): void => {
  httpClient.interceptors.response.use(
    async (response) => {
      if (response.data && typeof response.data.pipe === 'function') {
        return await streamResponse(response)
      }
      return response
    },
    async (error) => {
      if (
        error.response?.data &&
        typeof error.response.data.pipe === 'function'
      ) {
        try {
          await streamResponse(error.response)
        } catch (streamError) {
          logger.warn('Error processing error response stream:')
        }
      }
      throw new HttpError(error)
    },
  )
}

export default addInterceptors
