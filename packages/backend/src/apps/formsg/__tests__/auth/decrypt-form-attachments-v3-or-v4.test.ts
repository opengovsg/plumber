import { FormField } from '@opengovsg/formsg-sdk/dist/types'
import { IGlobalVariable, IRequest } from '@plumber/types'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { decryptFormAttachmentsV3OrV4 } from '../../auth/decrypt-form-attachments-v3-or-v4'
import { getSdk } from '../../common/form-env'

const mocks = vi.hoisted(() => {
  return {
    consoleError: vi.fn(),
    consoleWarn: vi.fn(),
    axiosGet: vi.fn(async () => ({
      data: {
        encryptedFile: {
          submissionPublicKey: 'Xva5B9ruxzidbHpucRGizb6iRnWLnoypkOdBn3scWDY=',
          nonce: '0hOPZZ8gpM+beUk/X/PjbFTThYyOffyv',
          binary:
            'I50wqO1h6fc2zQszCys7/nFmHUKvxEXtTAB7Wrc3XmjkTOWUc854EaEZzSS2gzuIG6h3YSz48cGtX4t9u1IVjs5G3zJZqjXex0N538WME52oIAIk7J8c9Q==',
        },
      },
    })),
  }
})

vi.mock('@/helpers/logger', () => ({
  default: {
    error: mocks.consoleError,
    warn: mocks.consoleWarn,
  },
}))

vi.mock('axios', () => ({
  default: {
    get: mocks.axiosGet,
    isAxiosError: (error: unknown) =>
      typeof error === 'object' &&
      error !== null &&
      (error as { isAxiosError?: boolean }).isAxiosError === true,
  },
}))

const formSgSdk = getSdk('prod')

// OK to commit - test data.
const SUBMISSION_SECRET_KEY = 'UEHWr01L6Fura3bGYxCH22w9kocYhxOcfUuznnCL21I='
const FORM_FIELDS: FormField[] = [
  {
    _id: '68f7ac5bd9b9803e70a2db61',
    fieldType: 'attachment',
    question: 'Attachment 1',
    answer: 'randomFile.txt',
  },
  {
    _id: '674321674321674321674321',
    fieldType: 'textfield',
    question: 'Name',
    answer: 'John Doe',
  },
  {
    _id: '69958687d939fdde2fec5e49',
    fieldType: 'attachment',
    question: 'Attachment 2',
    answer: 'randomFile2.txt',
  },
]

describe('decrypt form attachments v3', () => {
  let $: IGlobalVariable
  beforeEach(() => {
    $ = {
      request: {
        body: {
          data: {
            formId: '6878bfa1f4c0afec0b00d66c',
            submissionId: '699586d9ea08d91cf723aec2',
            encryptedContent:
              'LgJWBkp6MVo432cAMvAcRlPnhtggPJerpXiY3oteQGQ=;YpmLWI3Rv5GWLofAHm0UlrXu6MdckhXh:r+8dQYY6r8f/UUy6mDrzS/Ou5jVAWtnprn0quwbBdeMbG66r3/SOZI+cjoZS9J5XTVcQJyIUFpVhXvgURWeEV7Am8WBUREu9ssETGtjQHgqtscgL/KYydWYXoyPvgtyf/jU6x3TxUYYGfzRGmDAKfzojQkje12bY3vsfuKe1mFpZbSnF+tHBZYRTJM9PTJcRjXOYYNQ5q5nMDd6OahATt/rn9GGdw+aOpAS8HJkOiLAHV2gS0LE/4UB0RXmXbA6fOv/GGrRDFYPMpd8xdNX4TMLp4mrS6vG+lK5P6a769qIOadRL9AREY+yNXjGEbhRi8bquUewnRmpVUBVB/bYzA15c80Ve+lOrwKSmqeQoiH7L7kf1Q6p6ND5Rh7jQ4STs2oAF2HYQAiAW7MHPodQFh3tFj7lxYZqS5tkkeWdbZydkCdT9Y8GwNvlOsyl5UuXmqc9RntTGTuBvBsxu52+iyCg=',
            encryptedSubmissionSecretKey:
              'EC9w/sRlgNbc2RyiYS2yYJdrk5HLWwFHO/XUBgoHvQI=;/ydnXQTWCaMhfM0pBWy/33YwFb6dw1Xa:R4x79/GvAg0Gx7xs8dqv/McEErHH+peP43UJru+m+e3UUfqNKG2OpxBnOC14Pq4P',
            version: 3,
            created: '2026-02-18T09:31:05.563Z',
            attachmentDownloadUrls: {
              '68f7ac5bd9b9803e70a2db61':
                'https://s3.ap-southeast-1.amazonaws.com/attachments.form.gov.sg/6878bfa1f4c0afec0b00d66c/3717b2ffb126e8d78c78acd3c0742939f03ea0e3/123',
              '69958687d939fdde2fec5e49':
                'https://s3.ap-southeast-1.amazonaws.com/attachments.form.gov.sg/6878bfa1f4c0afec0b00d66c/60cc89ff7553e293f02daea73243208fa9fba137/345',
            },
          },
        },
      } as IRequest,
    } as IGlobalVariable
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  describe('decrypt attachments v3', () => {
    it('should return decrypted attachments when attachmentDownloadUrls is present', async () => {
      const result = await decryptFormAttachmentsV3OrV4(
        formSgSdk,
        SUBMISSION_SECRET_KEY,
        $.request.body.data.attachmentDownloadUrls,
        FORM_FIELDS,
      )
      expect(Object.keys(result)).toHaveLength(2)
      expect(result['68f7ac5bd9b9803e70a2db61']).toHaveProperty('filename')
      expect(result['68f7ac5bd9b9803e70a2db61']).toHaveProperty('content')
      expect(result['69958687d939fdde2fec5e49']).toHaveProperty('filename')
      expect(result['69958687d939fdde2fec5e49']).toHaveProperty('content')
    })

    it('should return empty object when attachmentDownloadUrls is empty', async () => {
      const result = await decryptFormAttachmentsV3OrV4(
        formSgSdk,
        SUBMISSION_SECRET_KEY,
        {},
        FORM_FIELDS,
      )
      expect(result).toBeDefined()
    })

    it('should return all attachments even if form fields are not present', async () => {
      const result = await decryptFormAttachmentsV3OrV4(
        formSgSdk,
        SUBMISSION_SECRET_KEY,
        $.request.body.data.attachmentDownloadUrls,
        [],
      )
      expect(Object.keys(result)).toHaveLength(2)
    })

    it('should throw an error if decryption fails', async () => {
      await expect(
        decryptFormAttachmentsV3OrV4(
          formSgSdk,
          'Lrw9HdnQwiCE5umnmrIkhff60WKmMGXrCgtLXgdZtzs=', // invalid
          $.request.body.data.attachmentDownloadUrls,
          FORM_FIELDS,
        ),
      ).rejects.toThrow()
    })

    it('should retry a transient 503 and still return both attachments', async () => {
      mocks.axiosGet.mockRejectedValueOnce({
        isAxiosError: true,
        message: 'Request failed with status code 503',
        response: { status: 503 },
      })

      const result = await decryptFormAttachmentsV3OrV4(
        formSgSdk,
        SUBMISSION_SECRET_KEY,
        $.request.body.data.attachmentDownloadUrls,
        FORM_FIELDS,
      )

      expect(Object.keys(result)).toHaveLength(2)
      expect(mocks.axiosGet).toHaveBeenCalledTimes(3)
    })

    it('should throw an error if downloading fails', async () => {
      mocks.axiosGet.mockRejectedValueOnce(new Error('Download failed'))
      await expect(
        decryptFormAttachmentsV3OrV4(
          formSgSdk,
          SUBMISSION_SECRET_KEY,
          $.request.body.data.attachmentDownloadUrls,
          FORM_FIELDS,
        ),
      ).rejects.toThrow()
    })
  })
})
