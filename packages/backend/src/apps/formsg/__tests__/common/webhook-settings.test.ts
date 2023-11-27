import { IGlobalVariable, IHttpClient } from '@plumber/types'

import { AxiosError } from 'axios'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import HttpError from '@/errors/http'

import app from '../..'
import {
  FORMSG_WEBHOOK_REGISTRATION_MESSAGE,
  FORMSG_WEBHOOK_VERIFICATION_MESSAGE,
  registerWebhookUrl,
  verifyWebhookUrl,
} from '../../common/webhook-settings'

describe('formsg webhook registration', () => {
  let $: IGlobalVariable

  // Reset global variable
  beforeEach(() => {
    $ = {
      auth: {
        set: vi.fn(),
        data: {
          formId: '6443b3ce39eb170011772f98',
        },
      },
      webhookUrl:
        'https://plumber.gov.sg/webhooks/f3a8b2d5-b62a-46ae-a419-4696bd92c3ff',
      http: {
        post: vi.fn(),
        patch: vi.fn(),
      } as unknown as IHttpClient, // deliberately cast,
      user: {
        id: 'abc-def',
        email: 'tester@open.gov.sg',
      },
      app,
    }
  })

  // Reset each mock after tests
  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('verify webhook url', () => {
    it('should return success if webhook url is already set', async () => {
      $.http.post = vi.fn().mockResolvedValueOnce({
        data: {
          webhook: {
            url: $.webhookUrl,
          },
        },
      })
      await expect(verifyWebhookUrl($)).resolves.toEqual({
        registrationVerified: true,
        message: FORMSG_WEBHOOK_VERIFICATION_MESSAGE.VERIFIED,
      })
    })

    it('should return false if webhook url is not set', async () => {
      $.http.post = vi.fn().mockResolvedValueOnce({
        data: {
          webhook: {
            url: '',
          },
        },
      })
      await expect(verifyWebhookUrl($)).resolves.toEqual({
        registrationVerified: false,
        message: undefined,
      })
    })

    it('should return false if webhook url is set to another pipe', async () => {
      $.http.post = vi.fn().mockResolvedValueOnce({
        data: {
          webhook: {
            url: 'https://plumber.gov.sg/webhooks/something-else',
          },
        },
      })
      await expect(verifyWebhookUrl($)).resolves.toEqual({
        registrationVerified: false,
        message: FORMSG_WEBHOOK_VERIFICATION_MESSAGE.ANOTHER_PIPE,
      })
    })

    it('should return false if webhook url is set to another non-pipe url', async () => {
      $.http.post = vi.fn().mockResolvedValueOnce({
        data: {
          webhook: {
            url: 'https://webhook.site/123',
          },
        },
      })
      await expect(verifyWebhookUrl($)).resolves.toEqual({
        registrationVerified: false,
        message: FORMSG_WEBHOOK_VERIFICATION_MESSAGE.ANOTHER_ENDPOINT,
      })
    })

    it('should return false if an error occurs', async () => {
      const error = {
        response: {
          status: 500,
        },
      } as AxiosError
      $.http.post = vi.fn().mockRejectedValueOnce(new HttpError(error))
      await expect(verifyWebhookUrl($)).resolves.toEqual({
        registrationVerified: false,
        message: FORMSG_WEBHOOK_VERIFICATION_MESSAGE.ERROR,
      })
    })

    it('should return false with err msg if user is not owner or editor', async () => {
      const error403 = {
        response: {
          status: 403,
        },
      } as AxiosError
      $.http.post = vi.fn().mockRejectedValueOnce(new HttpError(error403))
      await expect(verifyWebhookUrl($)).resolves.toEqual({
        registrationVerified: false,
        message: FORMSG_WEBHOOK_VERIFICATION_MESSAGE.UNAUTHORIZED,
      })
    })

    it('should return false if user is not a registered formsg user', async () => {
      const error422 = {
        response: {
          status: 422,
        },
      } as AxiosError
      $.http.post = vi.fn().mockRejectedValueOnce(new HttpError(error422))
      await expect(verifyWebhookUrl($)).resolves.toEqual({
        registrationVerified: false,
        message: FORMSG_WEBHOOK_VERIFICATION_MESSAGE.UNAUTHORIZED,
      })
    })
  })

  describe('register webhook url', () => {
    it('should resolve if webhook is set correctly', async () => {
      $.http.patch = vi.fn().mockResolvedValueOnce({
        data: {
          webhook: {
            url: $.webhookUrl,
            isRetryEnabled: true,
          },
        },
      })
      await expect(registerWebhookUrl($)).resolves.toBeUndefined()
    })

    it('should resolve if patch endpoint fails', async () => {
      $.http.patch = vi.fn().mockRejectedValueOnce({
        response: {
          status: 400,
        },
      })
      await expect(registerWebhookUrl($)).rejects.toThrowError()
    })

    it('should reject if user is not owner or editor', async () => {
      const error403 = {
        response: {
          status: 403,
        },
      } as AxiosError
      $.http.patch = vi.fn().mockRejectedValueOnce(new HttpError(error403))
      await expect(registerWebhookUrl($)).rejects.toThrowError(
        FORMSG_WEBHOOK_REGISTRATION_MESSAGE.UNAUTHORIZED,
      )
    })
    it('should reject if user is not a registered formsg user', async () => {
      const error422 = {
        response: {
          status: 422,
        },
      } as AxiosError
      $.http.patch = vi.fn().mockRejectedValueOnce(new HttpError(error422))
      await expect(registerWebhookUrl($)).rejects.toThrowError(
        FORMSG_WEBHOOK_REGISTRATION_MESSAGE.UNAUTHORIZED,
      )
    })
  })
})
