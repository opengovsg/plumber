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
  return {
    webhooksAuthenticate: vi.fn(),
    cryptoDecrypt: vi.fn(),
    consoleError: vi.fn(),
  }
})

// Mock formsg sdk
vi.mock('@opengovsg/formsg-sdk', () => {
  return {
    default: () => ({
      webhooks: {
        authenticate: mocks.webhooksAuthenticate,
      },
      crypto: {
        decrypt: mocks.cryptoDecrypt,
      },
    }),
  }
})

// mock logger
vi.mock('@/helpers/logger', () => ({
  default: {
    error: mocks.consoleError,
  },
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
        parameters: {
          nricFilter: undefined,
        },
      },
      flow: {
        id: 'flowid',
      },
      app,
    }
  })

  // restore mocks after each test
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should fail if no request in global variable', async () => {
    delete $.request
    await expect(decryptFormResponse($)).resolves.toEqual(false)
    expect(mocks.consoleError).toHaveBeenCalledWith('No trigger item provided')
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

  it('should fail if unable to decrypt form response', async () => {
    mocks.cryptoDecrypt.mockReturnValueOnce(null)
    await expect(decryptFormResponse($)).resolves.toEqual(false)
    expect(mocks.cryptoDecrypt).toHaveBeenCalledTimes(1)
    expect(mocks.consoleError).toHaveBeenCalledWith(
      'Unable to decrypt formsg response',
    )
  })

  it('should extract submission ID', async () => {
    mocks.cryptoDecrypt.mockReturnValueOnce({
      responses: [],
    })
    await expect(decryptFormResponse($)).resolves.toEqual(true)
    expect($.request.body).toEqual(
      expect.objectContaining({
        submissionId: 'submissionId',
      }),
    )
  })

  it('should extract submission time as a ISO 8601 SGT formatted string', async () => {
    mocks.cryptoDecrypt.mockReturnValueOnce({
      responses: [],
    })
    await expect(decryptFormResponse($)).resolves.toEqual(true)
    expect($.request.body).toEqual(
      expect.objectContaining({
        submissionTime: '2023-07-06T18:26:27.505+08:00',
      }),
    )
  })

  it('should parse form fields into dictionaries', async () => {
    mocks.cryptoDecrypt.mockReturnValueOnce({
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
      mocks.cryptoDecrypt.mockReturnValue({
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
        }),
      )
    })
  })

  it('should parse verified fields', async () => {
    mocks.cryptoDecrypt.mockReturnValueOnce({
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
        cpUid: 'U987654323PLUMBER',
      },
    })
    await expect(decryptFormResponse($)).resolves.toEqual(true)
    expect($.request.body).toEqual({
      fields: {
        question1: {
          fieldType: 'textarea',
          question: 'What do you eat for breakfast?',
          answer: 'i eat lorem dimsum for breakfast',
          order: 1,
        },
      },
      submissionId: 'submissionId',
      verifiedSubmitterInfo: {
        sgidUinFin: 'S1234567A',
        cpUid: 'U987654323PLUMBER',
      },
    })
  })
})
