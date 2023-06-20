import { IGlobalVariable, IHttpClient } from '@plumber/types'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import app from '../..'
import {
  verifyFormCreds,
  verifyFormIdFormat,
  verifySecretKeyFormat,
} from '../../auth/verify-credentials'

const mocks = vi.hoisted(() => {
  return {
    cryptoValid: vi.fn(),
  }
})

vi.mock('@opengovsg/formsg-sdk', () => {
  return {
    default: () => ({
      crypto: {
        valid: mocks.cryptoValid,
      },
    }),
  }
})

describe('verify credentials', () => {
  let $: IGlobalVariable

  beforeEach(() => {
    $ = {
      auth: {
        set: vi.fn(),
        data: {
          formId: '6443b3ce39eb170011772f98',
          privateKey: '/vuJ3+VUF0WOmAAdtg6g0YLa0Eh9WkRsaJ2UWLs+waQ=',
        },
      },
      http: {
        get: vi.fn().mockResolvedValue({
          data: {
            form: {
              title: 'Test Form',
              publicKey: 'public key',
            },
          },
        }),
      } as unknown as IHttpClient, // deliberately cast
      app,
    }
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('verify secret key format', () => {
    it('should throw error if secret key is of invalid format', () => {
      $.auth.data.privateKey = 'invalid string'
      expect(() => verifySecretKeyFormat($)).toThrowError(
        'Invalid secret key format',
      )
    })

    it('should not throw error if secret key is of valid format', () => {
      expect(verifySecretKeyFormat($)).toBe($.auth.data.privateKey)
    })
  })

  describe('verify form id format', () => {
    it('should accept a valid form id', () => {
      expect(verifyFormIdFormat($)).toBe($.auth.data.formId)
    })

    it('should accept a valid form url', () => {
      const formId = $.auth.data.formId
      $.auth.data.formId = 'https://form.gov.sg/' + formId
      expect(verifyFormIdFormat($)).toBe(formId)
    })

    it('should throw an error if invalid form url', () => {
      const formId = $.auth.data.formId
      $.auth.data.formId = 'https://firm.gov.sg/' + formId
      expect(() => verifyFormIdFormat($)).toThrowError('Invalid form url')
    })
  })

  describe('verify form creds', () => {
    it('should accept valid form creds', async () => {
      mocks.cryptoValid.mockReturnValueOnce(true)
      await expect(
        verifyFormCreds(
          $,
          $.auth.data.formId as string,
          $.auth.data.privateKey as string,
        ),
      ).resolves.toBeUndefined()
      expect($.auth.set).toHaveBeenCalledWith({
        screenName: '6443b3ce39eb170011772f98 - Test Form',
      })
    })

    it('should throw an error if form is not public', async () => {
      $.http.get = vi.fn().mockRejectedValueOnce({
        response: {
          status: 404,
          data: {
            isPageFound: true,
          },
        },
      })
      await expect(
        verifyFormCreds(
          $,
          $.auth.data.formId as string,
          $.auth.data.privateKey as string,
        ),
      ).rejects.toThrowError('Ensure form is public')
    })

    it('should throw an error if form is not found', async () => {
      $.http.get = vi.fn().mockRejectedValueOnce({
        response: {
          status: 404,
        },
      })
      await expect(
        verifyFormCreds(
          $,
          $.auth.data.formId as string,
          $.auth.data.privateKey as string,
        ),
      ).rejects.toThrowError('Form not found')
    })

    it('should throw an error if form is not storage mode', async () => {
      $.http.get = vi.fn().mockResolvedValueOnce({
        data: {
          form: {
            title: 'Test Form',
          },
        },
      })
      await expect(
        verifyFormCreds(
          $,
          $.auth.data.formId as string,
          $.auth.data.privateKey as string,
        ),
      ).rejects.toThrowError('Form is not a storage mode form')
    })

    it('should throw an error if form secret key does not match public key', async () => {
      mocks.cryptoValid.mockReturnValueOnce(false)
      await expect(
        verifyFormCreds(
          $,
          $.auth.data.formId as string,
          $.auth.data.privateKey as string,
        ),
      ).rejects.toThrowError('Invalid secret key')
    })
  })
})
