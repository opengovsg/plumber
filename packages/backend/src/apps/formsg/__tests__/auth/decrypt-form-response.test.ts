import { IGlobalVariable, IRequest } from '@plumber/types'
import { Settings as LuxonSettings } from 'luxon'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import apps from '@/apps'
import { FOR_EACH_INPUT_SOURCE } from '@/apps/toolbox/common/constants'

import { decryptFormResponse } from '../../auth/decrypt-form-response'
import { NricFilter } from '../../triggers/new-submission'

// TZ formatting replicated here (see appConfig) as tests don't load the app
// config module.
LuxonSettings.defaultZone = 'Asia/Singapore'
LuxonSettings.defaultLocale = 'en-SG'

const SUCCESS_DECRYPT_RESPONSE = {
  verified: true,
  internalId: 'submissionId',
}

const FAILED_DECRYPT_RESPONSE = {
  verified: false,
  internalId: null as string | null,
}

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
    consoleInfo: vi.fn(),
    getSdk: vi.fn(() => mockSdk),
    parseFormEnv: vi.fn(),
    whitelistEmails: vi.fn().mockResolvedValue([]),
  }
})

// mock logger
vi.mock('@/helpers/logger', () => ({
  default: {
    error: mocks.consoleError,
    warn: mocks.consoleWarn,
    info: mocks.consoleInfo,
  },
}))

// mock email suppression model
vi.mock('@/models/email-suppression-entry', () => ({
  default: {
    whitelistEmails: mocks.whitelistEmails,
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
        appKey: apps.formsg.key,
        key: 'newSubmission',
        position: 0,
        parameters: {
          nricFilter: undefined,
        },
        version: 1,
      },
      flow: {
        id: 'flowid',
        userId: 'userid',
        hasFileProcessingActions: false,
        name: 'test flow',
        isActive: true,
      },
      user: {
        id: 'userid',
        email: 'test-email@open.gov.sg',
        createdAt: `${new Date().getTime()}`,
        updatedAt: `${new Date().getTime()}`,
      },
      app: apps.formsg,
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
      await expect(decryptFormResponse($)).resolves.toEqual(
        FAILED_DECRYPT_RESPONSE,
      )
      expect(mocks.consoleError).toHaveBeenCalledWith(
        'No trigger item provided',
      )
    })

    it('should fail if unable to verify form signature', async () => {
      mocks.webhooksAuthenticate.mockImplementationOnce(() => {
        throw new Error('error')
      })
      await expect(decryptFormResponse($)).resolves.toEqual(
        FAILED_DECRYPT_RESPONSE,
      )
      expect(mocks.webhooksAuthenticate).toHaveBeenCalledTimes(1)
      expect(mocks.consoleError).toHaveBeenCalledWith(
        'Unable to verify formsg signature',
      )
    })

    it('should fail and give warning if no connection exists', async () => {
      delete $.auth.data
      await expect(decryptFormResponse($)).resolves.toEqual(
        FAILED_DECRYPT_RESPONSE,
      )
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
      await expect(decryptFormResponse($)).resolves.toEqual(
        FAILED_DECRYPT_RESPONSE,
      )
      expect(decryptMock).toHaveBeenCalledTimes(1)
      expect(mocks.consoleWarn).toHaveBeenCalledWith(
        'Unable to decrypt formsg response',
      )
    })

    it('should extract submission ID', async () => {
      mockDecryptedSubmission({ responses: [] })
      await expect(decryptFormResponse($)).resolves.toEqual(
        SUCCESS_DECRYPT_RESPONSE,
      )
      expect($.request.body).toEqual(
        expect.objectContaining({
          submissionId: 'submissionId',
        }),
      )
    })

    it('should extract submission time as a ISO 8601 SGT formatted string', async () => {
      mockDecryptedSubmission({ responses: [] })
      await expect(decryptFormResponse($)).resolves.toEqual(
        SUCCESS_DECRYPT_RESPONSE,
      )
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
      await expect(decryptFormResponse($)).resolves.toEqual(
        SUCCESS_DECRYPT_RESPONSE,
      )
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
            cpUid: 'U987654323PLUMBER',
          },
        })
      })

      it('should handle nric filter - do nothing', async () => {
        await expect(decryptFormResponse($)).resolves.toEqual(
          SUCCESS_DECRYPT_RESPONSE,
        )
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
              sgidUinFin: 'S1234567A',
              cpUid: 'U987654323PLUMBER',
            },
          }),
        )
      })

      it('it should handle nric filter - remove', async () => {
        $.step.parameters.nricFilter = NricFilter.Remove
        await expect(decryptFormResponse($)).resolves.toEqual(
          SUCCESS_DECRYPT_RESPONSE,
        )
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
        await expect(decryptFormResponse($)).resolves.toEqual(
          SUCCESS_DECRYPT_RESPONSE,
        )
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
              sgidUinFin: 'Z1cImQNbDXdmOaeS2roacWNxH7MbJC75OiEeYOjSbRo=',
              cpUid: 'U987654323PLUMBER',
            },
          }),
        )
      })

      it('it should handle nric filter - mask', async () => {
        $.step.parameters.nricFilter = NricFilter.Mask
        await expect(decryptFormResponse($)).resolves.toEqual(
          SUCCESS_DECRYPT_RESPONSE,
        )
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
              sgidUinFin: 'xxxxx567A',
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
          uinFin: '12345678B',
          cpUid: 'U987654323PLUMBER',
          cpUen: '987654321Z',
        },
      })
      await expect(decryptFormResponse($)).resolves.toEqual(
        SUCCESS_DECRYPT_RESPONSE,
      )
      expect($.request.body).toEqual(
        expect.objectContaining({
          verifiedSubmitterInfo: {
            sgidUinFin: '12345678B',
            uinFin: '12345678B',
            cpUid: 'U987654323PLUMBER',
            cpUen: '987654321Z',
          },
        }),
      )
    })

    it('should parse form fields and replace dots with underscores in keys', async () => {
      mockDecryptedSubmission({
        responses: [
          {
            _id: 'question1.field.answer',
            fieldType: 'textarea',
            question: 'What do you eat for breakfast?',
            answer: 'i eat lorem dimsum for breakfast',
          },
          {
            _id: 'question2.field.answer',
            fieldType: 'mobile',
            question: 'What is your mobile number?',
            answer: '+6591234567',
          },
        ],
      })
      await expect(decryptFormResponse($)).resolves.toEqual(
        SUCCESS_DECRYPT_RESPONSE,
      )
      expect($.request.body).toEqual(
        expect.objectContaining({
          fields: {
            question1_field_answer: {
              fieldType: 'textarea',
              question: 'What do you eat for breakfast?',
              answer: 'i eat lorem dimsum for breakfast',
              order: 1,
            },
            question2_field_answer: {
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

    it('should parse form fields and replace dots with underscores in keys', async () => {
      mockDecryptedSubmission({
        responses: [
          {
            _id: 'childrenbirthrecords.abc.childdateofbirth.0',
            fieldType: 'children',
            question: 'Child Date of birth',
            answer: '31/03/2017',
          },
          {
            _id: 'childrenbirthrecords.abc.childname.0',
            fieldType: 'children',
            question: 'Child Name',
            answer: 'John Doe',
          },
          {
            _id: 'question2.field.answer',
            fieldType: 'mobile',
            question: 'What is your mobile number?',
            answer: '+6591234567',
          },
        ],
      })
      await expect(decryptFormResponse($)).resolves.toEqual(
        SUCCESS_DECRYPT_RESPONSE,
      )
      expect($.request.body).toEqual(
        expect.objectContaining({
          fields: {
            childrenbirthrecords_abc_childdateofbirth_0: {
              fieldType: 'children',
              question: 'Child Date of birth',
              answer: '31/03/2017',
              order: 1,
            },
            childrenbirthrecords_abc_childname_0: {
              fieldType: 'children',
              question: 'Child Name',
              answer: 'John Doe',
              order: 2,
            },
            question2_field_answer: {
              fieldType: 'mobile',
              question: 'What is your mobile number?',
              answer: '+6591234567',
              order: 3,
            },
          },
        }),
      )
      expect($.request.headers).toBeUndefined()
      expect($.request.query).toBeUndefined()
    })
  })

  describe('attachments', () => {
    it('attachment decryption function not called if pipe does not process files', async () => {
      $.flow.hasFileProcessingActions = false
      mocks.cryptoDecrypt.mockReturnValueOnce({ responses: [] })
      await expect(decryptFormResponse($)).resolves.toEqual(
        SUCCESS_DECRYPT_RESPONSE,
      )
      expect(mocks.cryptoDecryptWithAttachments).not.toBeCalled()
    })

    it('attachment decryption function called if pipe processes files', async () => {
      $.flow.hasFileProcessingActions = true
      mocks.cryptoDecryptWithAttachments.mockResolvedValueOnce({
        attachments: {},
        content: { responses: [] },
      })
      await expect(decryptFormResponse($)).resolves.toEqual(
        SUCCESS_DECRYPT_RESPONSE,
      )
      expect(mocks.cryptoDecrypt).not.toBeCalled()
    })
  })

  describe('form environments', () => {
    it('should grab the sdk corresponding to the form environment', async () => {
      $.flow.hasFileProcessingActions = false
      mocks.cryptoDecrypt.mockReturnValueOnce({ responses: [] })
      mocks.parseFormEnv.mockReturnValue('staging')

      await expect(decryptFormResponse($)).resolves.toEqual(
        SUCCESS_DECRYPT_RESPONSE,
      )

      expect(mocks.parseFormEnv).toBeCalled()
      expect(mocks.getSdk).toBeCalledWith('staging')
    })
  })

  describe('local address field', () => {
    it('should handle local address fields', async () => {
      $.flow.hasFileProcessingActions = false
      mocks.cryptoDecrypt.mockReturnValueOnce({
        responses: [
          {
            _id: 'addressFieldComplete',
            fieldType: 'address',
            question: 'What is your address?',
            answerArray: [
              '51',
              'BRAS BASAH ROAD',
              'Lazada One',
              '08',
              '888',
              '189554',
            ],
          },
          {
            _id: 'addressFieldPartial',
            fieldType: 'address',
            question: 'What is your address?',
            answerArray: ['51', 'BRAS BASAH ROAD', '', '', '', '189554'],
          },
        ],
      })

      await expect(decryptFormResponse($)).resolves.toEqual(
        SUCCESS_DECRYPT_RESPONSE,
      )
      expect($.request.body).toEqual(
        expect.objectContaining({
          fields: {
            addressFieldComplete: {
              fieldType: 'address',
              question: 'What is your address?',
              answerArray: [
                '51',
                'BRAS BASAH ROAD',
                'Lazada One',
                '#08-888',
                '189554',
              ],
              order: 1,
            },
            addressFieldPartial: {
              fieldType: 'address',
              question: 'What is your address?',
              answerArray: ['51', 'BRAS BASAH ROAD', '', '', '189554'],
              order: 2,
            },
          },
        }),
      )
    })
  })

  describe('null character sanitisation', () => {
    it('should handle normal answer field with null characters', async () => {
      $.flow.hasFileProcessingActions = false
      mocks.cryptoDecrypt.mockReturnValueOnce({
        responses: [
          {
            _id: 'textField',
            fieldType: 'text',
            question: 'What is your name?',
            answer: 'John\u0000 Tan\u0000',
          },
        ],
      })

      await expect(decryptFormResponse($)).resolves.toEqual(
        SUCCESS_DECRYPT_RESPONSE,
      )
      expect($.request.body).toEqual(
        expect.objectContaining({
          fields: {
            textField: {
              fieldType: 'text',
              question: 'What is your name?',
              answer: 'John Tan',
              order: 1,
            },
          },
        }),
      )
    })

    it('should handle 1D array field answerArray', async () => {
      $.flow.hasFileProcessingActions = false
      mocks.cryptoDecrypt.mockReturnValueOnce({
        responses: [
          {
            _id: 'checkboxField',
            fieldType: 'checkbox',
            question: 'What are your hobbies?',
            answerArray: ['reading', 'gaming', 'coding'],
          },
        ],
      })

      await expect(decryptFormResponse($)).resolves.toEqual(
        SUCCESS_DECRYPT_RESPONSE,
      )
      expect($.request.body).toEqual(
        expect.objectContaining({
          fields: {
            checkboxField: {
              fieldType: 'checkbox',
              question: 'What are your hobbies?',
              answerArray: ['reading', 'gaming', 'coding'],
              order: 1,
            },
          },
        }),
      )
    })

    it('should handle 2D array field answerArray', async () => {
      $.flow.hasFileProcessingActions = false
      mocks.cryptoDecrypt.mockReturnValueOnce({
        responses: [
          {
            _id: 'tableField',
            fieldType: 'table',
            question: 'What are your hobbies and when do you do them?',
            answerArray: [
              ['reading', 'night'],
              ['gaming', 'weekend'],
              ['coding', 'day'],
            ],
          },
        ],
      })

      await expect(decryptFormResponse($)).resolves.toEqual(
        SUCCESS_DECRYPT_RESPONSE,
      )
      expect($.request.body).toEqual(
        expect.objectContaining({
          fields: {
            tableField: {
              fieldType: 'table',
              question: 'What are your hobbies and when do you do them?',
              answer: JSON.stringify({
                rows: [
                  {
                    data: {
                      [Buffer.from('Col 1').toString('hex')]: 'reading',
                      [Buffer.from('Col 2').toString('hex')]: 'night',
                    },
                  },
                  {
                    data: {
                      [Buffer.from('Col 1').toString('hex')]: 'gaming',
                      [Buffer.from('Col 2').toString('hex')]: 'weekend',
                    },
                  },
                  {
                    data: {
                      [Buffer.from('Col 1').toString('hex')]: 'coding',
                      [Buffer.from('Col 2').toString('hex')]: 'day',
                    },
                  },
                ],
                columns: [
                  {
                    id: Buffer.from('Col 1').toString('hex'),
                    label: 'Col 1',
                    name: 'Col 1',
                    value: `data.rows.*.data.${Buffer.from('Col 1').toString(
                      'hex',
                    )}`,
                  },
                  {
                    id: Buffer.from('Col 2').toString('hex'),
                    label: 'Col 2',
                    name: 'Col 2',
                    value: `data.rows.*.data.${Buffer.from('Col 2').toString(
                      'hex',
                    )}`,
                  },
                ],
                inputSource: FOR_EACH_INPUT_SOURCE.FORMSG_TABLE,
              }),
              answerArray: [
                ['reading', 'night'],
                ['gaming', 'weekend'],
                ['coding', 'day'],
              ],
              order: 1,
            },
          },
        }),
      )
    })

    it('should handle answerArray with null characters', async () => {
      $.flow.hasFileProcessingActions = false
      mocks.cryptoDecrypt.mockReturnValueOnce({
        responses: [
          {
            _id: 'checkboxField',
            fieldType: 'checkbox',
            question: 'What are your hobbies?',
            answerArray: [
              'reading\u0000',
              '\u0000gaming\u0000',
              '\u0000coding',
            ],
          },
          {
            _id: 'tableField',
            fieldType: 'table',
            question: 'What are your hobbies and when do you do them?',
            answerArray: [
              ['reading\u0000', 'night\u0000'],
              ['gaming\u0000', 'weekend\u0000\u0000\u0000'],
            ],
          },
        ],
      })

      await expect(decryptFormResponse($)).resolves.toEqual(
        SUCCESS_DECRYPT_RESPONSE,
      )
      expect($.request.body).toEqual(
        expect.objectContaining({
          fields: {
            checkboxField: {
              fieldType: 'checkbox',
              question: 'What are your hobbies?',
              answerArray: ['reading', 'gaming', 'coding'],
              order: 1,
            },
            tableField: {
              fieldType: 'table',
              question: 'What are your hobbies and when do you do them?',
              answerArray: [
                ['reading', 'night'],
                ['gaming', 'weekend'],
              ],
              answer: JSON.stringify({
                rows: [
                  {
                    data: {
                      [Buffer.from('Col 1').toString('hex')]: 'reading',
                      [Buffer.from('Col 2').toString('hex')]: 'night',
                    },
                  },
                  {
                    data: {
                      [Buffer.from('Col 1').toString('hex')]: 'gaming',
                      [Buffer.from('Col 2').toString('hex')]: 'weekend',
                    },
                  },
                ],
                columns: [
                  {
                    id: Buffer.from('Col 1').toString('hex'),
                    label: 'Col 1',
                    name: 'Col 1',
                    value: `data.rows.*.data.${Buffer.from('Col 1').toString(
                      'hex',
                    )}`,
                  },
                  {
                    id: Buffer.from('Col 2').toString('hex'),
                    label: 'Col 2',
                    name: 'Col 2',
                    value: `data.rows.*.data.${Buffer.from('Col 2').toString(
                      'hex',
                    )}`,
                  },
                ],
                inputSource: FOR_EACH_INPUT_SOURCE.FORMSG_TABLE,
              }),
              order: 2,
            },
          },
        }),
      )
    })

    it('should handle empty answerArray', async () => {
      $.flow.hasFileProcessingActions = false
      mocks.cryptoDecrypt.mockReturnValueOnce({
        responses: [
          {
            _id: 'checkboxField',
            fieldType: 'checkbox',
            question: 'What are your hobbies?',
            answerArray: [],
          },
        ],
      })

      await expect(decryptFormResponse($)).resolves.toEqual(
        SUCCESS_DECRYPT_RESPONSE,
      )
      expect($.request.body).toEqual(
        expect.objectContaining({
          fields: {
            checkboxField: {
              fieldType: 'checkbox',
              question: 'What are your hobbies?',
              answerArray: [],
              order: 1,
            },
          },
        }),
      )
    })
  })

  describe('signature field', () => {
    it('should handle signature field with signature captured', async () => {
      $.flow.hasFileProcessingActions = false
      mocks.cryptoDecrypt.mockReturnValueOnce({
        responses: [
          {
            _id: 'signatureField',
            fieldType: 'signature',
            question: 'Please sign here',
            answerArray: [1.1, 1.2, 1.3],
          },
        ],
      })

      await expect(decryptFormResponse($)).resolves.toEqual(
        SUCCESS_DECRYPT_RESPONSE,
      )
      expect($.request.body).toEqual(
        expect.objectContaining({
          fields: {
            signatureField: {
              fieldType: 'signature',
              question: 'Please sign here',
              answer: 'Signature captured',
              order: 1,
            },
          },
        }),
      )
    })

    it('should handle signature field without signature', async () => {
      $.flow.hasFileProcessingActions = false
      mocks.cryptoDecrypt.mockReturnValueOnce({
        responses: [
          {
            _id: 'signatureField',
            fieldType: 'signature',
            question: 'Please sign here',
            answerArray: [],
          },
        ],
      })

      await expect(decryptFormResponse($)).resolves.toEqual(
        SUCCESS_DECRYPT_RESPONSE,
      )
      expect($.request.body).toEqual(
        expect.objectContaining({
          fields: {
            signatureField: {
              fieldType: 'signature',
              question: 'Please sign here',
              answer: '',
              order: 1,
            },
          },
        }),
      )
    })
  })

  describe('verified email suppression removal', () => {
    it('whitelists the email when isUserVerified is true (v1 shape)', async () => {
      $.flow.hasFileProcessingActions = false
      mocks.cryptoDecrypt.mockReturnValueOnce({
        responses: [
          {
            _id: 'emailField',
            fieldType: 'email',
            question: 'Email',
            answer: 'jack@open.gov.sg',
            isUserVerified: true,
            signature: 'f=...,v=...,t=...,s=...',
          },
        ],
      })

      await expect(decryptFormResponse($)).resolves.toEqual(
        SUCCESS_DECRYPT_RESPONSE,
      )
      expect(mocks.whitelistEmails).toHaveBeenCalledWith(['jack@open.gov.sg'])
    })

    it('whitelists the email via signature presence when isUserVerified is absent (v3/v4 shape)', async () => {
      $.flow.hasFileProcessingActions = false
      mocks.cryptoDecrypt.mockReturnValueOnce({
        responses: [
          {
            _id: 'emailField',
            fieldType: 'email',
            question: 'Email',
            answer: 'jane@open.gov.sg',
            signature: 'f=...,v=...,t=...,s=...',
          },
        ],
      })

      await expect(decryptFormResponse($)).resolves.toEqual(
        SUCCESS_DECRYPT_RESPONSE,
      )
      expect(mocks.whitelistEmails).toHaveBeenCalledWith(['jane@open.gov.sg'])
    })

    it('does not whitelist when isUserVerified is false', async () => {
      $.flow.hasFileProcessingActions = false
      mocks.cryptoDecrypt.mockReturnValueOnce({
        responses: [
          {
            _id: 'emailField',
            fieldType: 'email',
            question: 'Email',
            answer: 'unverified@open.gov.sg',
            isUserVerified: false,
          },
        ],
      })

      await expect(decryptFormResponse($)).resolves.toEqual(
        SUCCESS_DECRYPT_RESPONSE,
      )
      expect(mocks.whitelistEmails).not.toHaveBeenCalled()
    })

    it('does not whitelist when there is no email field at all', async () => {
      $.flow.hasFileProcessingActions = false
      mocks.cryptoDecrypt.mockReturnValueOnce({
        responses: [
          {
            _id: 'textField',
            fieldType: 'text',
            question: 'What is your name?',
            answer: 'John Tan',
          },
        ],
      })

      await expect(decryptFormResponse($)).resolves.toEqual(
        SUCCESS_DECRYPT_RESPONSE,
      )
      expect(mocks.whitelistEmails).not.toHaveBeenCalled()
    })

    it('batches multiple verified email fields into a single whitelistEmails call', async () => {
      $.flow.hasFileProcessingActions = false
      mocks.cryptoDecrypt.mockReturnValueOnce({
        responses: [
          {
            _id: 'emailField1',
            fieldType: 'email',
            question: 'Personal email',
            answer: 'personal@open.gov.sg',
            isUserVerified: true,
          },
          {
            _id: 'emailField2',
            fieldType: 'email',
            question: 'Work email',
            answer: 'work@open.gov.sg',
            isUserVerified: true,
          },
        ],
      })

      await expect(decryptFormResponse($)).resolves.toEqual(
        SUCCESS_DECRYPT_RESPONSE,
      )
      expect(mocks.whitelistEmails).toHaveBeenCalledTimes(1)
      expect(mocks.whitelistEmails).toHaveBeenCalledWith([
        'personal@open.gov.sg',
        'work@open.gov.sg',
      ])
    })

    it('does not affect the decrypt result when whitelistEmails throws', async () => {
      $.flow.hasFileProcessingActions = false
      mocks.cryptoDecrypt.mockReturnValueOnce({
        responses: [
          {
            _id: 'emailField',
            fieldType: 'email',
            question: 'Email',
            answer: 'jack@open.gov.sg',
            isUserVerified: true,
          },
        ],
      })
      mocks.whitelistEmails.mockRejectedValueOnce(new Error('db error'))

      await expect(decryptFormResponse($)).resolves.toEqual(
        SUCCESS_DECRYPT_RESPONSE,
      )
      expect(mocks.consoleError).toHaveBeenCalledWith(
        'Failed to whitelist verified FormSG email(s) from suppression list',
        expect.objectContaining({
          event: 'formsg-verified-email-whitelist-failed',
        }),
      )
    })

    it('logs which emails were actually whitelisted', async () => {
      $.flow.hasFileProcessingActions = false
      mocks.cryptoDecrypt.mockReturnValueOnce({
        responses: [
          {
            _id: 'emailField',
            fieldType: 'email',
            question: 'Email',
            answer: 'jack@open.gov.sg',
            isUserVerified: true,
          },
        ],
      })
      mocks.whitelistEmails.mockResolvedValueOnce(['jack@open.gov.sg'])

      await expect(decryptFormResponse($)).resolves.toEqual(
        SUCCESS_DECRYPT_RESPONSE,
      )
      expect(mocks.consoleInfo).toHaveBeenCalledWith(
        'Removed verified FormSG email(s) from suppression list',
        expect.objectContaining({
          event: 'formsg-verified-email-whitelist',
          emails: ['jack@open.gov.sg'],
        }),
      )
    })
  })
})
