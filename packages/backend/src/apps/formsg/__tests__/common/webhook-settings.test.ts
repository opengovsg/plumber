import { IGlobalVariable, IHttpClient } from '@plumber/types'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import app from '../..'
import {
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
      userEmail: 'tester@open.gov.sg',
      app,
    }
  })

  // Reset each mock after tests
  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('verify webhook url', () => {
    it('should return success if webhook url is already set', () => {
      $.http.post = vi.fn().mockResolvedValueOnce({
        data: {
          webhook: {
            url: $.webhookUrl,
          },
        },
      })
      expect(verifyWebhookUrl($)).resolves.toEqual({
        success: true,
        message: FORMSG_WEBHOOK_VERIFICATION_MESSAGE.VERIFIED,
      })
    })

    it('should return false if webhook url is not set', () => {
      $.http.post = vi.fn().mockResolvedValueOnce({
        data: {
          webhook: {
            url: '',
          },
        },
      })
      expect(verifyWebhookUrl($)).resolves.toEqual({
        success: false,
        message: FORMSG_WEBHOOK_VERIFICATION_MESSAGE.EMPTY,
      })
    })

    it('should return false if webhook url is set to another pipe', () => {
      $.http.post = vi.fn().mockResolvedValueOnce({
        data: {
          webhook: {
            url: 'https://plumber.gov.sg/webhooks/something-else',
          },
        },
      })
      expect(verifyWebhookUrl($)).resolves.toEqual({
        success: false,
        message: FORMSG_WEBHOOK_VERIFICATION_MESSAGE.ANOTHER_PIPE,
      })
    })

    it('should return false if webhook url is set to another non-pipe url', () => {
      $.http.post = vi.fn().mockResolvedValueOnce({
        data: {
          webhook: {
            url: 'https://webhook.site/123',
          },
        },
      })
      expect(verifyWebhookUrl($)).resolves.toEqual({
        success: false,
        message: FORMSG_WEBHOOK_VERIFICATION_MESSAGE.ANOTHER_ENDPOINT,
      })
    })

    it('should return false if an error occurs', () => {
      $.http.post = vi.fn().mockRejectedValueOnce({
        response: {
          status: 500,
        },
      })
      expect(verifyWebhookUrl($)).resolves.toEqual({
        success: false,
        message: FORMSG_WEBHOOK_VERIFICATION_MESSAGE.ERROR,
      })
    })
  })

  describe('verify webhook url', () => {
    it('should resolve if webhook is set correctly', () => {
      $.http.patch = vi.fn().mockResolvedValueOnce({
        data: {
          webhook: {
            url: $.webhookUrl,
            isRetryEnabled: true,
          },
        },
      })
      expect(registerWebhookUrl($)).resolves.toBeUndefined()
    })

    it('should resolve if patch endpoint fails', () => {
      $.http.patch = vi.fn().mockRejectedValueOnce({
        response: {
          status: 400,
        },
      })
      expect(registerWebhookUrl($)).rejects.toThrowError()
    })
  })
})
