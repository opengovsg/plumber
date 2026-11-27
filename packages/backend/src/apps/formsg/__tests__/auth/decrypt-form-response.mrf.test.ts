import { IGlobalVariable, IRequest } from '@plumber/types'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import apps from '@/apps'

import { decryptFormResponse } from '../../auth/decrypt-form-response'
import type {
  FormSchemaField,
  FormsgPayloadWorkflowContent,
} from '../../common/types'
import { NricFilter } from '../../triggers/new-submission'

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
    parseFormEnv: vi.fn(() => 'prod'),
    storeAttachmentInS3: vi.fn(() => 'mock-s3-id'),
    // Only form_fields is read downstream, so fixtures supply just that.
    fetchFormSchema: vi.fn(
      async (): Promise<{ form: { form_fields: FormSchemaField[] } } | null> =>
        null,
    ),
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

// IGlobalVariable.request is optional, but every test here goes through the
// webhook path where it is always present.
type GlobalVariableWithRequest = IGlobalVariable & { request: IRequest }

function makeGlobalVariable(): GlobalVariableWithRequest {
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
      isActive: true,
    },
    user: {
      id: 'userid',
      email: 'test-email@open.gov.sg',
      createdAt: `${new Date().getTime()}`,
      updatedAt: `${new Date().getTime()}`,
    },
    app: apps.formsg,
  } as unknown as GlobalVariableWithRequest
}

describe('decrypt form response - MRF specific', () => {
  let $: GlobalVariableWithRequest

  beforeEach(() => {
    $ = makeGlobalVariable()
  })

  afterEach(() => {
    vi.clearAllMocks()
    vi.restoreAllMocks()
  })

  describe('empty response map', () => {
    const schema = {
      form: {
        form_fields: [
          { _id: 'head', title: 'Details', fieldType: 'section' },
          { _id: 'q1', title: 'Optional question', fieldType: 'textfield' },
        ],
      },
    }

    it('restores headers and blank answers when a v4 envelope has no responses', async () => {
      $.request.body.data.version = 4
      mocks.fetchFormSchema.mockResolvedValueOnce(schema)
      mocks.cryptoV3Decrypt.mockReturnValueOnce({
        responses: {},
        verified: undefined,
      })

      await decryptFormResponse($)

      expect($.request.body.fields).toEqual({
        head: {
          order: 1,
          fieldType: 'section',
          question: 'Details',
          answer: '',
        },
        q1: {
          order: 2,
          fieldType: 'textfield',
          question: 'Optional question',
          answer: '',
        },
      })
    })

    it('keeps the v3 path for an empty map in a v3 envelope', async () => {
      mocks.fetchFormSchema.mockResolvedValueOnce(schema)
      mocks.cryptoV3Decrypt.mockReturnValueOnce({
        responses: {},
        verified: undefined,
      })

      await decryptFormResponse($)

      expect($.request.body.fields).toEqual({})
    })
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

    it('should trust attachment URLs under the form env-specific prefix for non-prod envs', async () => {
      $.flow.hasFileProcessingActions = true
      mocks.parseFormEnv.mockReturnValueOnce('stg')
      $.request.body.data.attachmentDownloadUrls = {
        attachField1:
          'https://s3.ap-southeast-1.amazonaws.com/attachments.stg.form.gov.sg/123',
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
            'https://s3.ap-southeast-1.amazonaws.com/attachments.stg.form.gov.sg/123',
        },
        expect.any(Array),
      )
    })

    it('should return verified: false when an attachment URL uses the prod prefix for a staging form', async () => {
      $.flow.hasFileProcessingActions = true
      mocks.parseFormEnv.mockReturnValueOnce('stg')
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

      const result = await decryptFormResponse($)

      expect(result).toEqual({ verified: false, internalId: null })
      expect(mocks.decryptFormAttachmentsV3OrV4).not.toHaveBeenCalled()
    })

    it('should return verified: false without downloading when an attachment URL is untrusted', async () => {
      $.flow.hasFileProcessingActions = true
      $.request.body.data.attachmentDownloadUrls = {
        attachField1:
          'https://s3.ap-southeast-1.amazonaws.com/attachments.form.gov.sg/123',
        attachField2: 'https://plumber.svc.cluster.local/a',
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

      const result = await decryptFormResponse($)

      expect(result).toEqual({ verified: false, internalId: null })
      expect(mocks.decryptFormAttachmentsV3OrV4).not.toHaveBeenCalled()
      expect(mocks.consoleError).toHaveBeenCalledWith(
        expect.objectContaining({
          event: 'formsg-untrusted-attachment-url',
          submissionId: 'submissionId',
          attachmentDownloadUrls: {
            attachField1:
              'https://s3.ap-southeast-1.amazonaws.com/attachments.form.gov.sg/123',
            attachField2: 'https://plumber.svc.cluster.local/a',
          },
        }),
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
        attachField1:
          'https://s3.ap-southeast-1.amazonaws.com/attachments.form.gov.sg/download/1',
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

    describe('table column titles', () => {
      const COL_1_ID = Buffer.from('Col 1').toString('hex')
      const COL_2_ID = Buffer.from('Col 2').toString('hex')

      function mockTableSchema() {
        mocks.fetchFormSchema.mockResolvedValueOnce({
          form: {
            form_fields: [
              {
                _id: 'tbl',
                title: 'Items',
                fieldType: 'table',
                columns: [
                  { title: 'Name (optional', _id: 'col1' },
                  { title: 'Qty', _id: 'col2' },
                ],
              },
            ],
          },
        })
      }

      it.each([
        ['an empty', {}, []],
        [
          'a filled',
          { 'row-a': { rowNum: 0, value: { col1: 'Apple', col2: '3' } } },
          [{ data: { [COL_1_ID]: 'Apple', [COL_2_ID]: '3' } }],
        ],
      ])(
        'gives %s v4 table the schema columns when a title has an unmatched bracket',
        async (_, answer, rows) => {
          mockTableSchema()
          mocks.cryptoV3Decrypt.mockReturnValueOnce({
            responses: {
              tbl: {
                fieldType: 'table',
                question: 'Items',
                answer,
                provenance: V4_PROVENANCE,
              },
            },
            verified: undefined,
          })

          await decryptFormResponse($)

          const table = $.request.body.fields.tbl
          expect(table).not.toHaveProperty('tableColumnTitles')
          expect(JSON.parse(table.answer)).toMatchObject({
            rows,
            columns: [
              { id: COL_1_ID, label: 'Name (optional' },
              { id: COL_2_ID, label: 'Qty' },
            ],
          })
        },
      )

      it('keeps parsing the question for a v3 table', async () => {
        mockTableSchema()
        mocks.cryptoV3Decrypt.mockReturnValueOnce({
          responses: {
            tbl: {
              fieldType: 'table',
              answer: [{ col1: 'Apple', col2: '3' }],
            },
          },
          verified: undefined,
        })

        await decryptFormResponse($)

        expect(
          JSON.parse($.request.body.fields.tbl.answer).columns,
        ).toMatchObject([
          { id: COL_1_ID, label: 'Col 1' },
          { id: COL_2_ID, label: 'Col 2' },
        ])
      })
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
    it.each([
      { key: 'myInfoUinFin (Step 1)', reason: 'unknown_verified_key' },
      { key: 'cpUen (Step 1)', reason: null },
      { key: 'cpUen', reason: null },
      { key: 'uinFin (Step 2)', reason: 'later_step_verified_key' },
      { key: 'cpUid (Step 12)', reason: 'later_step_verified_key' },
    ])(
      'logs verified key $key with reason $reason',
      async ({ key, reason }) => {
        mocks.cryptoV3Decrypt.mockReturnValueOnce({
          responses: {},
          verified: { [key]: 'S1234567A' },
        })

        await decryptFormResponse($)

        expect(mocks.consoleWarn.mock.calls.map(([, meta]) => meta)).toEqual(
          reason
            ? [
                {
                  event: 'formsg-unsupported-payload',
                  reason,
                  formId: 'formId123',
                  key,
                },
              ]
            : [],
        )
      },
    )

    it('should keep mapping a later step verified key to its base key', async () => {
      $.request.body.data.workflowContent = makeWorkflowContent(1)
      mocks.cryptoV3Decrypt.mockReturnValueOnce({
        responses: {},
        verified: { 'cpUen (Step 2)': '201912345A' },
      })

      await decryptFormResponse($)

      expect($.request.body.verifiedSubmitterInfo).toEqual({
        cpUen: '201912345A',
      })
    })

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

    it('should map "cpUen (Step 1)" and "cpUid (Step 1)" to cpUen and cpUid', async () => {
      $.request.body.data.workflowContent = makeWorkflowContent(1)
      mocks.cryptoV3Decrypt.mockReturnValueOnce({
        responses: {},
        verified: {
          'cpUen (Step 1)': '201912345A',
          'cpUid (Step 1)': 'S1234567D',
        },
      })

      await decryptFormResponse($)

      expect($.request.body.verifiedSubmitterInfo).toEqual({
        cpUen: '201912345A',
        cpUid: 'S1234567D',
      })
    })

    it('should still map plain cpUen and cpUid keys correctly', async () => {
      $.request.body.data.workflowContent = makeWorkflowContent(0)
      mocks.cryptoV3Decrypt.mockReturnValueOnce({
        responses: {},
        verified: { cpUen: '201912345A', cpUid: 'S1234567D' },
      })

      await decryptFormResponse($)

      expect($.request.body.verifiedSubmitterInfo).toEqual({
        cpUen: '201912345A',
        cpUid: 'S1234567D',
      })
    })

    it('should apply the NRIC filter to step-suffixed uinFin keys', async () => {
      $.step.parameters.nricFilter = NricFilter.Mask
      $.request.body.data.workflowContent = makeWorkflowContent(1)
      mocks.cryptoV3Decrypt.mockReturnValueOnce({
        responses: {},
        verified: { 'uinFin (Step 1)': 'S1234567A' },
      })

      await decryptFormResponse($)

      expect($.request.body.verifiedSubmitterInfo).toEqual({
        uinFin: 'xxxxx567A',
        sgidUinFin: 'xxxxx567A',
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
          attachmentField1:
            'https://s3.ap-southeast-1.amazonaws.com/attachments.form.gov.sg/download/1',
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
          attachmentField1:
            'https://s3.ap-southeast-1.amazonaws.com/attachments.form.gov.sg/download/1',
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
