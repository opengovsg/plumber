import { IGlobalVariable, IRequest } from '@plumber/types'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import apps from '@/apps'

import { decryptFormResponse } from '../../auth/decrypt-form-response'
import type { FormsgPayloadWorkflowContent } from '../../common/types'

import {
  exampleV4Submission,
  makeExampleV4FormSchema,
} from './v4-submission.mock'

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
    decryptFormAttachmentsV3OrV4: vi.fn(() => ({})),
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

vi.mock('../../auth/decrypt-form-attachments-v3-or-v4', () => ({
  decryptFormAttachmentsV3OrV4: mocks.decryptFormAttachmentsV3OrV4,
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

function makeGlobalVariable(): IGlobalVariable {
  return {
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
    },
    user: {
      id: 'userid',
      email: 'test-email@open.gov.sg',
      createdAt: `${new Date().getTime()}`,
      updatedAt: `${new Date().getTime()}`,
    },
    app: apps.formsg,
  }
}

describe('decrypt form response - MRF specific', () => {
  let $: IGlobalVariable

  beforeEach(() => {
    $ = makeGlobalVariable()
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

    it('should pass the decrypted submissionSecretKey to decryptFormAttachmentsV3OrV4 for v3 attachments', async () => {
      $.flow.hasFileProcessingActions = true
      $.request.body.data.attachmentDownloadUrls = {
        attachField1:
          'https://s3.ap-southeast-1.amazonaws.com/attachments.form.gov.sg/123',
      }

      mocks.cryptoV3Decrypt.mockReturnValueOnce({
        submissionSecretKey: 'mock-secret-key',
        responses: {
          attachField1: {
            fieldType: 'attachment',
            answer: { answer: 'myfile.pdf' },
          },
        },
        verified: undefined,
      })
      mocks.decryptFormAttachmentsV3OrV4.mockResolvedValueOnce({
        attachField1: {
          filename: 'myfile.pdf',
          content: Buffer.from('file content'),
        },
      })

      await decryptFormResponse($)

      expect(mocks.decryptFormAttachmentsV3OrV4).toHaveBeenCalledWith(
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

      expect(mocks.decryptFormAttachmentsV3OrV4).not.toHaveBeenCalled()
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

      expect(mocks.decryptFormAttachmentsV3OrV4).not.toHaveBeenCalled()
    })
  })

  describe('v4 decryption path', () => {
    // v4-shaped content is detected via the per-response `provenance` object
    const V4_PROVENANCE = { submittedAt: '2023-07-06T10:26:27.505Z' }

    it('should route a real v4 submission through processResponsesV4', async () => {
      // schema titles come from the shared fixture's schema, not the
      // responses' inline "[Myinfo] "-prefixed questions
      mocks.fetchFormSchema.mockResolvedValueOnce(makeExampleV4FormSchema())
      mocks.cryptoV3Decrypt.mockReturnValueOnce(exampleV4Submission)

      const result = await decryptFormResponse($)

      expect(result).toEqual({ verified: true, internalId: 'submissionId' })

      const fields = $.request.body.fields
      expect(Object.keys(fields)).toHaveLength(54)

      // MyInfo-prefilled text field; the { value } unwrap proves the v4
      // branch was taken (the v3 path would have kept the answer object)
      expect(fields['69eedf3b2e18526ffea6335c']).toEqual({
        order: 1,
        fieldType: 'textfield',
        question: 'Name',
        answer: 'AH KOW, TAN',
      })
      // date is reformatted dd/MM/yyyy → dd MMM yyyy
      expect(fields['69eedf4120948ed94fae09b9']).toMatchObject({
        fieldType: 'date',
        question: 'Date of birth',
        answer: '12 Jan 1980',
      })
      // radiobutton: regular option and others input
      expect(fields['69eeddcf8844a134ddbadc56'].answer).toBe('Option 2')
      expect(fields['69eeddd53c9ffa7a2b464687'].answer).toBe('Others: adg')
      // checkbox: FormSG's internal others marker becomes "Others: <input>"
      expect(fields['69eedde76df93497297710b1'].answerArray).toEqual([
        'Option 2',
        'Others: adw',
        'Option 1',
      ])
      // verified email keeps only the value, not the verification signature
      expect(fields['69eede812e18526ffea60af3']).toMatchObject({
        fieldType: 'email',
        answer: 'ahkow@open.gov.local',
      })
      // address goes through processLocalAddress (empty level + unit numbers
      // are combined into one empty slot)
      expect(fields['69eede9f2f788da6393fbd91'].answerArray).toEqual([
        '123',
        'TAN AH MENG ROAD',
        '',
        '',
        '123456',
      ])
      // signature is summarised downstream and its points dropped
      expect(fields['69eedeb17cfa1c89fc419340'].answer).toBe(
        'Signature captured',
      )
      expect(fields['69eedeb17cfa1c89fc419340'].answerArray).toBeUndefined()
      // table becomes a matrix plus a serialised table object
      const table = fields['69eedec5fd2757b0584e0be5']
      expect(table.question).toBe('Table (Column 1, Column 2)')
      expect(table.answerArray).toEqual([
        ['a', 'Option 1'],
        ['b', 'Option 2'],
      ])
      expect(JSON.parse(table.answer).rows).toHaveLength(2)
      // attachment keeps the filename (no file-processing actions configured)
      expect(fields['69eedecafd2757b0584e0c54']).toMatchObject({
        order: 54,
        fieldType: 'attachment',
        answer: 'Screenshot.png',
      })
      // the MRF "uinFin (Step N)" verified key maps back to uinFin/sgidUinFin
      expect($.request.body.verifiedSubmitterInfo).toEqual({
        uinFin: 'S1234567D',
        sgidUinFin: 'S1234567D',
      })
    })

    it('should produce a request body identical to the v3 path for equivalent content', async () => {
      const $v3 = makeGlobalVariable()
      mocks.cryptoV3Decrypt.mockReturnValueOnce({
        responses: {
          field1: { fieldType: 'textfield', answer: 'hello' },
          field2: { fieldType: 'checkbox', answer: { value: ['a', 'b'] } },
        },
        verified: undefined,
      })
      await decryptFormResponse($v3)

      // the same submission content, v4-shaped
      const $v4 = makeGlobalVariable()
      mocks.cryptoV3Decrypt.mockReturnValueOnce({
        submissionSecretKey: 'mock-secret-key',
        responses: {
          field1: {
            fieldType: 'textfield',
            answer: { value: 'hello' },
            question: 'Your name',
            provenance: V4_PROVENANCE,
          },
          field2: {
            fieldType: 'checkbox',
            answer: { value: ['a', 'b'] },
            question: 'Hobbies',
            provenance: V4_PROVENANCE,
          },
        },
        verified: undefined,
      })
      await decryptFormResponse($v4)

      expect($v4.request.body).toEqual($v3.request.body)
      expect($v3.request.body.fields.field1.answer).toBe('hello')
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
        mocks.decryptFormAttachmentsV3OrV4.mockResolvedValueOnce({
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
        mocks.decryptFormAttachmentsV3OrV4.mockResolvedValueOnce({
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
