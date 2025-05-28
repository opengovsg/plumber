import type { IGlobalVariable } from '@plumber/types'

import type { AxiosError } from 'axios'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import HttpError from '@/errors/http'
import RetriableError from '@/errors/retriable-error'
import StepError from '@/errors/step'

import requestErrorHandler from '../common/request-error-handler'

describe('Postman SMS request error handler', () => {
  let $: IGlobalVariable

  beforeEach(() => {
    $ = {
      app: {
        name: 'postman-sms',
      },
      step: {
        position: 2,
      },
    } as unknown as IGlobalVariable
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('HTTP 429 (Too Many Requests)', () => {
    it('throws `step` RetriableError with default delay when retry-after header is missing', async () => {
      const axiosError = {
        isAxiosError: true,
        name: 'AxiosError',
        message: 'Request failed with status code 429',
        response: {
          status: 429,
        },
      } as unknown as AxiosError

      const error = new HttpError(axiosError)

      await expect(requestErrorHandler($, error)).rejects.toThrow(
        RetriableError,
      )
      await expect(requestErrorHandler($, error)).rejects.toMatchObject({
        delayType: 'step',
        delayInMs: 3000,
      })
    })
  })

  describe('HTTP 400 with parameter_invalid', () => {
    it('throws StepError with campaign template setup message', async () => {
      const axiosError = {
        isAxiosError: true,
        name: 'AxiosError',
        message: 'Request failed with status code 400',
        response: {
          status: 400,
          data: {
            error: {
              code: 'parameter_invalid',
            },
          },
        },
      } as unknown as AxiosError

      const error = new HttpError(axiosError)

      await expect(requestErrorHandler($, error)).rejects.toThrow(StepError)
    })
  })

  describe('Other errors', () => {
    it('throws StepError with generic error message', async () => {
      const axiosError = {
        isAxiosError: true,
        name: 'AxiosError',
        message: 'Internal server error',
        response: {
          status: 500,
        },
      } as unknown as AxiosError

      const error = new HttpError(axiosError)

      await expect(requestErrorHandler($, error)).rejects.toThrow(StepError)
    })
  })
})
