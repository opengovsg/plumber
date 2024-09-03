import { IGlobalVariable, IRequest } from '@plumber/types'

import { Settings as LuxonSettings } from 'luxon'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import app from '../..'
import { decryptFormResponse } from '../../auth/decrypt-form-response'
import { NricFilter } from '../../triggers/new-submission'

// TZ formatting replicated here (see appConfig) as tests don't load the app
// config module.
LuxonSettings.defaultZone = 'Asia/Singapore'
LuxonSettings.defaultLocale = 'en-SG'

// mocks hoisted here so that they can be used in import mocks
const mocks = vi.hoisted(() => {
  const webhooksAuthenticate = vi.fn()
  const cryptoDecrypt = vi.fn()
  const cryptoDecryptWithAttachments = vi.fn()
  const mockSdk = {
    webhooks: {
      authenticate: webhooksAuthenticate,
    },
    crypto: {
      decrypt: cryptoDecrypt,
      decryptWithAttachments: cryptoDecryptWithAttachments,
    },
  }

  return {
    webhooksAuthenticate,
    cryptoDecrypt,
    cryptoDecryptWithAttachments,
    consoleError: vi.fn(),
    consoleWarn: vi.fn(),
    getSdk: vi.fn(() => mockSdk),
    parseFormEnv: vi.fn(),
  }
})

// mock logger
vi.mock('@/helpers/logger', () => ({
  default: {
    error: mocks.consoleError,
    warn: mocks.consoleWarn,
  },
}))

vi.mock('../../common/form-env', () => ({
  getSdk: mocks.getSdk,
  parseFormEnv: mocks.parseFormEnv,
}))

describe('decrypt form response', () => {
  let $: IGlobalVariable

  // reset global variable before each test
  beforeEach(() => {
    $ = {
      request: {
        query: {
          formId: 'something',
        } as Record<string, string>,
        headers: {
          'x-formsg-signature': 'signature',
        } as Record<string, string>,
        body: {
          data: {
            submissionId: 'submissionId',
            created: '2023-07-06T10:26:27.505Z',
          },
        },
      } as IRequest,
      auth: {
        set: vi.fn(),
        data: {
          formId: 'something',
          privateKey: 'secretkey',
        },
      },
      step: {
        id: '123',
        appKey: app.key,
        position: 0,
        parameters: {
          nricFilter: undefined,
        },
      },
      flow: {
        id: 'flowid',
        userId: 'userid',
        hasFileProcessingActions: false,
        name: 'test flow',
      },
      user: {
        id: 'userid',
        email: 'test-email@open.gov.sg',
        createdAt: `${new Date().getTime()}`,
        updatedAt: `${new Date().getTime()}`,
      },
      app,
    }
  })

  // restore mocks after each test
  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe.each([
    { hasFileProcessingActions: true },
    { hasFileProcessingActions: false },
  ])('common functions', ({ hasFileProcessingActions }) => {
    const decryptMock = hasFileProcessingActions
      ? mocks.cryptoDecryptWithAttachments
      : mocks.cryptoDecrypt
    const mockDecryptedSubmission = (submission: any) =>
      hasFileProcessingActions
        ? mocks.cryptoDecryptWithAttachments.mockResolvedValueOnce({
            attachments: {},
            content: submission,
          })
        : mocks.cryptoDecrypt.mockReturnValueOnce(submission)

    beforeEach(() => {
      $.flow.hasFileProcessingActions = hasFileProcessingActions
    })

    it('should fail if no request in global variable', async () => {
      delete $.request
      await expect(decryptFormResponse($)).resolves.toEqual(false)
      expect(mocks.consoleError).toHaveBeenCalledWith(
        'No trigger item provided',
      )
    })

    it('should fail if unable to verify form signature', async () => {
      mocks.webhooksAuthenticate.mockImplementationOnce(() => {
        throw new Error('error')
      })
      await expect(decryptFormResponse($)).resolves.toEqual(false)
      expect(mocks.webhooksAuthenticate).toHaveBeenCalledTimes(1)
      expect(mocks.consoleError).toHaveBeenCalledWith(
        'Unable to verify formsg signature',
      )
    })

    it('should fail and give warning if no connection exists', async () => {
      delete $.auth.data
      await expect(decryptFormResponse($)).resolves.toEqual(false)
      expect(mocks.consoleWarn).toHaveBeenCalledWith(
        'Form is not connected to any pipe after pipe is transferred',
        {
          event: 'formsg-missing-connection',
          flowId: $.flow.id,
          stepId: $.step.id,
          userId: $.user.id,
        },
      )
    })

    it('should fail if unable to decrypt form response', async () => {
      mockDecryptedSubmission(null)
      await expect(decryptFormResponse($)).resolves.toEqual(false)
      expect(decryptMock).toHaveBeenCalledTimes(1)
      expect(mocks.consoleError).toHaveBeenCalledWith(
        'Unable to decrypt formsg response',
      )
    })

    it('should extract submission ID', async () => {
      mockDecryptedSubmission({ responses: [] })
      await expect(decryptFormResponse($)).resolves.toEqual(true)
      expect($.request.body).toEqual(
        expect.objectContaining({
          submissionId: 'submissionId',
        }),
      )
    })

    it('should extract submission time as a ISO 8601 SGT formatted string', async () => {
      mockDecryptedSubmission({ responses: [] })
      await expect(decryptFormResponse($)).resolves.toEqual(true)
      expect($.request.body).toEqual(
        expect.objectContaining({
          submissionTime: '2023-07-06T18:26:27.505+08:00',
        }),
      )
    })

    it('should parse form fields into dictionaries', async () => {
      mockDecryptedSubmission({
        responses: [
          {
            _id: 'question1',
            fieldType: 'textarea',
            question: 'What do you eat for breakfast?',
            answer: 'i eat lorem dimsum for breakfast',
          },
          {
            _id: 'question2',
            fieldType: 'mobile',
            question: 'What is your mobile number?',
            answer: '+6591234567',
          },
        ],
      })
      await expect(decryptFormResponse($)).resolves.toEqual(true)
      expect($.request.body).toEqual(
        expect.objectContaining({
          fields: {
            question1: {
              fieldType: 'textarea',
              question: 'What do you eat for breakfast?',
              answer: 'i eat lorem dimsum for breakfast',
              order: 1,
            },
            question2: {
              fieldType: 'mobile',
              question: 'What is your mobile number?',
              answer: '+6591234567',
              order: 2,
            },
          },
        }),
      )
      expect($.request.headers).toBeUndefined()
      expect($.request.query).toBeUndefined()
    })

    describe('nric filter', () => {
      beforeEach(() => {
        mockDecryptedSubmission({
          responses: [
            {
              _id: 'question1',
              fieldType: 'nric',
              question: 'what is your mom nric?',
              answer: 'T2927502A',
            },
            {
              _id: 'question2',
              fieldType: 'mobile',
              question: 'What is your mobile number?',
              answer: '+6591234567',
            },
            {
              _id: 'question3',
              fieldType: 'nric',
              question: 'what is your nric?',
              answer: 'S9943670J',
            },
          ],
          verified: {
            uinFin: 'S1234567A',
            sgidUinFin: 'S2345678B',
            cpUid: 'U987654323PLUMBER',
          },
        })
      })

      it('should handle nric filter - do nothing', async () => {
        await expect(decryptFormResponse($)).resolves.toEqual(true)
        expect($.request.body).toEqual(
          expect.objectContaining({
            fields: {
              question1: {
                fieldType: 'nric',
                question: 'what is your mom nric?',
                answer: 'T2927502A',
                order: 1,
              },
              question2: {
                fieldType: 'mobile',
                question: 'What is your mobile number?',
                answer: '+6591234567',
                order: 2,
              },
              question3: {
                fieldType: 'nric',
                question: 'what is your nric?',
                answer: 'S9943670J',
                order: 3,
              },
            },
            verifiedSubmitterInfo: {
              uinFin: 'S1234567A',
              sgidUinFin: 'S2345678B',
              cpUid: 'U987654323PLUMBER',
            },
          }),
        )
      })

      it('it should handle nric filter - remove', async () => {
        $.step.parameters.nricFilter = NricFilter.Remove
        await expect(decryptFormResponse($)).resolves.toEqual(true)
        expect($.request.body).toEqual(
          expect.objectContaining({
            fields: {
              question2: {
                fieldType: 'mobile',
                question: 'What is your mobile number?',
                answer: '+6591234567',
                order: 2,
              },
            },
            verifiedSubmitterInfo: {
              cpUid: 'U987654323PLUMBER',
            },
          }),
        )
      })

      it('it should handle nric filter - hash', async () => {
        $.step.parameters.nricFilter = NricFilter.Hash
        await expect(decryptFormResponse($)).resolves.toEqual(true)
        expect($.request.body).toEqual(
          expect.objectContaining({
            fields: {
              question1: {
                fieldType: 'nric',
                question: 'what is your mom nric?',
                answer: '+tkgnmGuaq7shFQoAIDQr8IqjWzrKE2bqyBDtJWhsYQ=',
                order: 1,
              },
              question2: {
                fieldType: 'mobile',
                question: 'What is your mobile number?',
                answer: '+6591234567',
                order: 2,
              },
              question3: {
                fieldType: 'nric',
                question: 'what is your nric?',
                answer: 'dDl7XRvFci/Zd0KXj961RP9mMHAC0LlopcMAcZlja1Q=',
                order: 3,
              },
            },
            verifiedSubmitterInfo: {
              uinFin: 'Z1cImQNbDXdmOaeS2roacWNxH7MbJC75OiEeYOjSbRo=',
              sgidUinFin: 'UAM3XbFrbNVVuD9Phz3KV/roZj4aG/Ql3Ap5Y5dTtJ4=',
              cpUid: 'U987654323PLUMBER',
            },
          }),
        )
      })

      it('it should handle nric filter - mask', async () => {
        $.step.parameters.nricFilter = NricFilter.Mask
        await expect(decryptFormResponse($)).resolves.toEqual(true)
        expect($.request.body).toEqual(
          expect.objectContaining({
            fields: {
              question1: {
                fieldType: 'nric',
                question: 'what is your mom nric?',
                answer: 'xxxxx502A',
                order: 1,
              },
              question2: {
                fieldType: 'mobile',
                question: 'What is your mobile number?',
                answer: '+6591234567',
                order: 2,
              },
              question3: {
                fieldType: 'nric',
                question: 'what is your nric?',
                answer: 'xxxxx670J',
                order: 3,
              },
            },
            verifiedSubmitterInfo: {
              uinFin: 'xxxxx567A',
              sgidUinFin: 'xxxxx678B',
              cpUid: 'U987654323PLUMBER',
            },
          }),
        )
      })
    })

    it('should parse verified fields', async () => {
      mockDecryptedSubmission({
        responses: [
          {
            _id: 'question1',
            fieldType: 'textarea',
            question: 'What do you eat for breakfast?',
            answer: 'i eat lorem dimsum for breakfast',
          },
        ],
        verified: {
          sgidUinFin: 'S1234567A',
          uinFin: '12345678B',
          cpUid: 'U987654323PLUMBER',
          cpUen: '987654321Z',
        },
      })
      await expect(decryptFormResponse($)).resolves.toEqual(true)
      expect($.request.body).toEqual(
        expect.objectContaining({
          verifiedSubmitterInfo: {
            sgidUinFin: 'S1234567A',
            uinFin: '12345678B',
            cpUid: 'U987654323PLUMBER',
            cpUen: '987654321Z',
          },
        }),
      )
    })
  })

  describe('attachments', () => {
    it('attachment decryption function not called if pipe does not process files', async () => {
      $.flow.hasFileProcessingActions = false
      mocks.cryptoDecrypt.mockReturnValueOnce({ responses: [] })
      await expect(decryptFormResponse($)).resolves.toEqual(true)
      expect(mocks.cryptoDecryptWithAttachments).not.toBeCalled()
    })

    it('attachment decryption function called if pipe processes files', async () => {
      $.flow.hasFileProcessingActions = true
      mocks.cryptoDecryptWithAttachments.mockResolvedValueOnce({
        attachments: {},
        content: { responses: [] },
      })
      await expect(decryptFormResponse($)).resolves.toEqual(true)
      expect(mocks.cryptoDecrypt).not.toBeCalled()
    })
  })

  describe('form environments', () => {
    it('should grab the sdk corresponding to the form environment', async () => {
      $.flow.hasFileProcessingActions = false
      mocks.cryptoDecrypt.mockReturnValueOnce({ responses: [] })
      mocks.parseFormEnv.mockReturnValue('staging')

      await expect(decryptFormResponse($)).resolves.toEqual(true)

      expect(mocks.parseFormEnv).toBeCalled()
      expect(mocks.getSdk).toBeCalledWith('staging')
    })
  })
})
