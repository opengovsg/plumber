import { IGlobalVariable, IRequest } from '@plumber/types'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import apps from '@/apps'

import { decryptFormResponse } from '../../auth/decrypt-form-response'
import type { FormsgPayloadWorkflowContent } from '../../common/types'

// mocks hoisted here so that they can be used in import mocks
const mocks = vi.hoisted(() => {
  const webhooksAuthenticate = vi.fn()
  const cryptoV3Decrypt = vi.fn()
  const mockSdk = {
    webhooks: {
      authenticate: webhooksAuthenticate,
    },
    cryptoV3: {
      decrypt: cryptoV3Decrypt,
    },
  }

  return {
    webhooksAuthenticate,
    cryptoV3Decrypt,
    consoleError: vi.fn(),
    consoleWarn: vi.fn(),
    getSdk: vi.fn(() => mockSdk),
    parseFormEnv: vi.fn(),
    storeAttachmentInS3: vi.fn(() => 'mock-s3-id'),
    fetchFormSchema: vi.fn(() => null),
    decryptSubmissionSecretKey: vi.fn(() => 'mock-secret-key'),
    decryptFormAttachmentsV3: vi.fn(() => ({})),
  }
})

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

vi.mock('../../auth/helpers/store-attachment-in-s3', () => ({
  default: mocks.storeAttachmentInS3,
}))

vi.mock('../../triggers/new-submission/fetch-form-schema', () => ({
  fetchFormSchema: mocks.fetchFormSchema,
}))

vi.mock('../../auth/decrypt-form-attachments-v3', () => ({
  decryptSubmissionSecretKey: mocks.decryptSubmissionSecretKey,
  decryptFormAttachmentsV3: mocks.decryptFormAttachmentsV3,
}))

const MOCK_WORKFLOW: FormsgPayloadWorkflowContent['workflow'] = [
  {
    _id: 'step-0-id',
    edit: ['field1'],
    step_name: 'Step 1',
    workflow_type: 'static',
  },
  {
    _id: 'step-1-id',
    edit: ['field2'],
    step_name: 'Step 2',
    workflow_type: 'static',
  },
  {
    _id: 'step-2-id',
    edit: ['field3'],
    step_name: 'Step 3',
    workflow_type: 'static',
  },
]

function makeWorkflowContent(
  workflowStep: number,
): FormsgPayloadWorkflowContent {
  return {
    workflow: MOCK_WORKFLOW,
    workflowStep,
    submittedSteps: [
      {
        isApproval: false,
        submittedAt: '2023-07-06T10:26:27.505Z',
      },
    ],
  }
}

describe('decrypt form response - MRF specific', () => {
  let $: IGlobalVariable

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
            formId: 'formId123',
            created: '2023-07-06T10:26:27.505Z',
            version: 3,
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
      app: apps.formsg,
    }
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('v3 decryption path', () => {
    it('should call cryptoV3.decrypt and processResponsesV3 for v3 submissions', async () => {
      const v3Responses = {
        field1: {
          fieldType: 'textfield',
          answer: 'hello',
        },
      }
      mocks.cryptoV3Decrypt.mockReturnValueOnce({
        responses: v3Responses,
        verified: undefined,
      })
      const bodyData = $.request.body.data
      await decryptFormResponse($)

      expect(mocks.cryptoV3Decrypt).toHaveBeenCalledWith('secretkey', bodyData)
      // processResponsesV3 calls fetchFormSchema internally
      expect(mocks.fetchFormSchema).toHaveBeenCalledWith($, 'formId123')
    })

    it('should call decryptSubmissionSecretKey and decryptFormAttachmentsV3 for v3 attachments', async () => {
      $.flow.hasFileProcessingActions = true
      $.request.body.data.attachmentDownloadUrls = {
        attachField1:
          'https://s3.ap-southeast-1.amazonaws.com/attachments.form.gov.sg/123',
      }
      $.request.body.data.encryptedSubmissionSecretKey = 'encrypted-key'

      mocks.cryptoV3Decrypt.mockReturnValueOnce({
        responses: {
          attachField1: {
            fieldType: 'attachment',
            answer: { answer: 'myfile.pdf' },
          },
        },
        verified: undefined,
      })
      mocks.decryptFormAttachmentsV3.mockResolvedValueOnce({
        attachField1: {
          filename: 'myfile.pdf',
          content: Buffer.from('file content'),
        },
      })

      await decryptFormResponse($)

      expect(mocks.decryptSubmissionSecretKey).toHaveBeenCalledWith(
        'secretkey',
        'encrypted-key',
      )
      expect(mocks.decryptFormAttachmentsV3).toHaveBeenCalledWith(
        mocks.getSdk(),
        'mock-secret-key',
        {
          attachField1:
            'https://s3.ap-southeast-1.amazonaws.com/attachments.form.gov.sg/123',
        },
        expect.any(Array),
      )
    })

    it('should return verified: false when decryption fails', async () => {
      mocks.cryptoV3Decrypt.mockReturnValueOnce(null)

      const result = await decryptFormResponse($)

      expect(result).toEqual({ verified: false, internalId: null })
      expect(mocks.consoleWarn).toHaveBeenCalled()
    })

    it('should not call v3 attachment decryption when no attachmentDownloadUrls', async () => {
      $.flow.hasFileProcessingActions = true

      mocks.cryptoV3Decrypt.mockReturnValueOnce({
        responses: {
          field1: { fieldType: 'textfield', answer: 'hello' },
        },
        verified: undefined,
      })

      await decryptFormResponse($)

      expect(mocks.decryptSubmissionSecretKey).not.toHaveBeenCalled()
      expect(mocks.decryptFormAttachmentsV3).not.toHaveBeenCalled()
    })

    it('should not call v3 attachment decryption when hasFileProcessingActions is false', async () => {
      $.flow.hasFileProcessingActions = false
      $.request.body.data.attachmentDownloadUrls = {
        attachField1: 'https://example.com/download/1',
      }

      mocks.cryptoV3Decrypt.mockReturnValueOnce({
        responses: {
          field1: { fieldType: 'textfield', answer: 'hello' },
        },
        verified: undefined,
      })

      await decryptFormResponse($)

      expect(mocks.decryptSubmissionSecretKey).not.toHaveBeenCalled()
      expect(mocks.decryptFormAttachmentsV3).not.toHaveBeenCalled()
    })
  })

  describe('return value and request body for MRF submissions', () => {
    it('should return isSubtrigger: false and set workflowContent when workflowStep is 0', async () => {
      const workflowContent = makeWorkflowContent(0)
      $.request.body.data.workflowContent = workflowContent
      mocks.cryptoV3Decrypt.mockReturnValueOnce({
        responses: {},
        verified: undefined,
      })

      const result = await decryptFormResponse($)

      expect(result).toEqual({
        verified: true,
        internalId: 'submissionId',
        isSubtrigger: false,
        subtriggerData: {
          type: 'mrf',
          mrfStepId: 'step-0-id',
        },
      })
      expect($.request.body.workflowContent).toEqual(workflowContent)
    })

    it('should return isSubtrigger: true and set workflowContent when workflowStep is 1', async () => {
      const workflowContent = makeWorkflowContent(1)
      $.request.body.data.workflowContent = workflowContent
      mocks.cryptoV3Decrypt.mockReturnValueOnce({
        responses: {},
        verified: undefined,
      })

      const result = await decryptFormResponse($)

      expect(result).toEqual({
        verified: true,
        internalId: 'submissionId',
        isSubtrigger: true,
        subtriggerData: {
          type: 'mrf',
          mrfStepId: 'step-1-id',
        },
      })
      expect($.request.body.workflowContent).toEqual(workflowContent)
    })

    it('should return correct mrfStepId from workflow array for workflowStep 2', async () => {
      const workflowContent = makeWorkflowContent(2)
      $.request.body.data.workflowContent = workflowContent
      mocks.cryptoV3Decrypt.mockReturnValueOnce({
        responses: {},
        verified: undefined,
      })

      const result = await decryptFormResponse($)

      expect(result).toEqual(
        expect.objectContaining({
          isSubtrigger: true,
          subtriggerData: {
            type: 'mrf',
            mrfStepId: 'step-2-id',
          },
        }),
      )
    })
  })

  describe('verifiedSubmitterInfo for MRF submissions', () => {
    it('should map "uinFin (Step 1)" to uinFin and sgidUinFin', async () => {
      $.request.body.data.workflowContent = makeWorkflowContent(1)
      mocks.cryptoV3Decrypt.mockReturnValueOnce({
        responses: {},
        verified: { 'uinFin (Step 1)': 'S1234567A' },
      })

      await decryptFormResponse($)

      expect($.request.body.verifiedSubmitterInfo).toEqual({
        uinFin: 'S1234567A',
        sgidUinFin: 'S1234567A',
      })
    })

    it('should still map plain uinFin key correctly', async () => {
      $.request.body.data.workflowContent = makeWorkflowContent(0)
      mocks.cryptoV3Decrypt.mockReturnValueOnce({
        responses: {},
        verified: { uinFin: 'S1234567A' },
      })

      await decryptFormResponse($)

      expect($.request.body.verifiedSubmitterInfo).toEqual({
        uinFin: 'S1234567A',
        sgidUinFin: 'S1234567A',
      })
    })
    describe('attachment storage ID suffix for MRF', () => {
      it('should suffix storageId with workflowStep for MRF attachments', async () => {
        $.flow.hasFileProcessingActions = true
        const workflowContent = makeWorkflowContent(2)
        $.request.body.data.workflowContent = workflowContent
        $.request.body.data.attachmentDownloadUrls = {
          attachmentField1: 'https://example.com/download/1',
        }
        $.request.body.data.encryptedSubmissionSecretKey = 'encrypted-key'

        mocks.cryptoV3Decrypt.mockReturnValueOnce({
          responses: {
            attachmentField1: {
              fieldType: 'attachment',
              answer: { answer: 'myfile.pdf' },
            },
          },
          verified: undefined,
        })
        mocks.decryptFormAttachmentsV3.mockResolvedValueOnce({
          attachmentField1: {
            filename: 'myfile.pdf',
            content: Buffer.from('file content'),
          },
        })

        await decryptFormResponse($)

        expect(mocks.storeAttachmentInS3).toHaveBeenCalledWith(
          $,
          'submissionId-2',
          expect.anything(),
          expect.anything(),
        )
      })

      it('should not suffix storageId for non-MRF attachments', async () => {
        $.flow.hasFileProcessingActions = true
        $.request.body.data.attachmentDownloadUrls = {
          attachmentField1: 'https://example.com/download/1',
        }
        $.request.body.data.encryptedSubmissionSecretKey = 'encrypted-key'

        mocks.cryptoV3Decrypt.mockReturnValueOnce({
          responses: {
            attachmentField1: {
              fieldType: 'attachment',
              answer: { answer: 'myfile.pdf' },
            },
          },
          verified: undefined,
        })
        mocks.decryptFormAttachmentsV3.mockResolvedValueOnce({
          attachmentField1: {
            filename: 'myfile.pdf',
            content: Buffer.from('file content'),
          },
        })

        await decryptFormResponse($)

        expect(mocks.storeAttachmentInS3).toHaveBeenCalledWith(
          $,
          'submissionId',
          expect.anything(),
          expect.anything(),
        )
      })
    })
  })
})
