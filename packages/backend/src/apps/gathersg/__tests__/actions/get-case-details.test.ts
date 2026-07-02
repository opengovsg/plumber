import type { IGlobalVariable } from '@plumber/types'

import { beforeEach, describe, expect, it, vi } from 'vitest'

import app from '../../..'
import getCaseDetailsAction from '../../actions/get-case-details'

const mocks = vi.hoisted(() => ({
  putObject: vi.fn(),
}))

vi.mock('@/helpers/s3', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/helpers/s3')>()
  return {
    ...actual,
    COMMON_S3_BUCKET: 'common-bucket',
    MAX_FILE_SIZE: 1024 * 1024, // 1MB, small enough to test the size guard
    putObject: mocks.putObject,
  }
})

const MOCK_CASE_UUID = 'case-uuid-123'
const MOCK_EXECUTION_ID = 'execution-id-123'
const MOCK_ATTACHMENT_UUID = 'attach-uuid-1'
const MOCK_ATTACHMENT_NAME = 'invoice.pdf'

describe('get case details', () => {
  let $: IGlobalVariable
  let httpGet: ReturnType<typeof vi.fn>

  beforeEach(() => {
    mocks.putObject.mockReset()

    httpGet = vi.fn(async (path: string) => {
      if (path === '/cases/:caseUuid') {
        return {
          data: {
            traceId: 'trace-1',
            data: {
              fields: {
                'A/B': 'value',
              },
              attachments: {
                [MOCK_ATTACHMENT_UUID]: {
                  name: MOCK_ATTACHMENT_NAME,
                  mimeType: 'application/octet-stream',
                  size: 12,
                },
              },
            },
          },
        }
      }

      if (path === '/cases/:caseUuid/attachments/:attachmentUuid') {
        return {
          data: Buffer.from('file-content'),
        }
      }

      throw new Error(`Unexpected path: ${path}`)
    })

    mocks.putObject.mockResolvedValue(
      `s3:common-bucket:${MOCK_EXECUTION_ID}/gathersg/${MOCK_CASE_UUID}/${MOCK_ATTACHMENT_UUID}/${MOCK_ATTACHMENT_NAME}`,
    )

    $ = {
      app,
      auth: {
        set: vi.fn(),
        data: { apiKey: 'sample-api-key' },
      },
      execution: {
        id: MOCK_EXECUTION_ID,
      },
      flow: {
        id: 'flow-id-123',
      },
      step: {
        id: 'step-id-123',
        appKey: 'gathersg',
        position: 2,
        parameters: {
          caseUuid: MOCK_CASE_UUID,
        },
      },
      http: {
        get: httpGet,
      } as unknown as IGlobalVariable['http'],
      setActionItem: vi.fn(),
    } as unknown as IGlobalVariable
  })

  it('downloads attachment, uploads to s3, and stores s3Id', async () => {
    await getCaseDetailsAction.run($)

    expect(httpGet).toHaveBeenCalledWith('/cases/:caseUuid', {
      urlPathParams: { caseUuid: MOCK_CASE_UUID },
    })
    expect(httpGet).toHaveBeenCalledWith(
      '/cases/:caseUuid/attachments/:attachmentUuid',
      {
        responseType: 'arraybuffer',
        urlPathParams: {
          caseUuid: MOCK_CASE_UUID,
          attachmentUuid: MOCK_ATTACHMENT_UUID,
        },
      },
    )

    expect(mocks.putObject).toHaveBeenCalledWith({
      bucket: 'common-bucket',
      objectKey: `${MOCK_EXECUTION_ID}/gathersg/${MOCK_CASE_UUID}/${MOCK_ATTACHMENT_UUID}/${MOCK_ATTACHMENT_NAME}`,
      body: Buffer.from('file-content'),
      metadata: {
        flowId: 'flow-id-123',
        stepId: 'step-id-123',
        executionId: MOCK_EXECUTION_ID,
        caseUuid: MOCK_CASE_UUID,
        attachmentUuid: MOCK_ATTACHMENT_UUID,
        filename: MOCK_ATTACHMENT_NAME,
      },
    })

    expect($.setActionItem).toHaveBeenCalledWith({
      raw: {
        traceId: 'trace-1',
        data: {
          fields: {
            __HEX_ENCODED__412f42: 'value',
          },
          attachments: [
            {
              attachmentUuid: MOCK_ATTACHMENT_UUID,
              name: MOCK_ATTACHMENT_NAME,
              mimeType: 'application/octet-stream',
              size: 12,
              s3Id: `s3:common-bucket:${MOCK_EXECUTION_ID}/gathersg/${MOCK_CASE_UUID}/${MOCK_ATTACHMENT_UUID}/${MOCK_ATTACHMENT_NAME}`,
            },
          ],
        },
      },
    })
  })

  it('skips upload when there are no attachments', async () => {
    httpGet.mockImplementationOnce(async () => ({
      data: {
        traceId: 'trace-1',
        data: {
          fields: { name: 'value' },
        },
      },
    }))

    await getCaseDetailsAction.run($)

    expect(mocks.putObject).not.toHaveBeenCalled()
    expect($.setActionItem).toHaveBeenCalledWith({
      raw: {
        traceId: 'trace-1',
        data: {
          fields: { name: 'value' },
          attachments: [],
        },
      },
    })
  })

  it('throws when attachment download fails', async () => {
    httpGet.mockImplementation(async (path: string) => {
      if (path === '/cases/:caseUuid') {
        return {
          data: {
            traceId: 'trace-1',
            data: {
              fields: { name: 'value' },
              attachments: {
                [MOCK_ATTACHMENT_UUID]: {
                  name: MOCK_ATTACHMENT_NAME,
                  mimeType: 'application/octet-stream',
                  size: 12,
                },
              },
            },
          },
        }
      }

      throw new Error('attachment download failed')
    })

    await expect(getCaseDetailsAction.run($)).rejects.toThrow(
      'Please check that you have configured your step correctly',
    )
  })

  it('throws when attachment exceeds maximum size', async () => {
    httpGet.mockImplementationOnce(async () => ({
      data: {
        traceId: 'trace-1',
        data: {
          fields: { name: 'value' },
          attachments: {
            [MOCK_ATTACHMENT_UUID]: {
              name: MOCK_ATTACHMENT_NAME,
              mimeType: 'application/octet-stream',
              size: 1024 * 1024 * 2, // 2MB, exceeds mocked MAX_FILE_SIZE of 1MB
            },
          },
        },
      },
    }))

    await expect(getCaseDetailsAction.run($)).rejects.toThrow(
      'exceeds maximum size',
    )
    expect(mocks.putObject).not.toHaveBeenCalled()
  })

  it('routes each attachment uuid to the correct download call and stores both', async () => {
    const MOCK_ATTACHMENT_UUID_2 = 'attach-uuid-2'
    const MOCK_ATTACHMENT_NAME_2 = 'receipt.png'

    httpGet.mockImplementation(async (path: string, options?: any) => {
      if (path === '/cases/:caseUuid') {
        return {
          data: {
            traceId: 'trace-1',
            data: {
              fields: {},
              attachments: {
                [MOCK_ATTACHMENT_UUID]: {
                  name: MOCK_ATTACHMENT_NAME,
                  mimeType: 'application/pdf',
                  size: 10,
                },
                [MOCK_ATTACHMENT_UUID_2]: {
                  name: MOCK_ATTACHMENT_NAME_2,
                  mimeType: 'image/png',
                  size: 20,
                },
              },
            },
          },
        }
      }

      if (path === '/cases/:caseUuid/attachments/:attachmentUuid') {
        const uuid = options?.urlPathParams?.attachmentUuid
        return { data: Buffer.from(`content-${uuid}`) }
      }

      throw new Error(`Unexpected path: ${path}`)
    })

    mocks.putObject
      .mockResolvedValueOnce(
        `s3:common-bucket:${MOCK_EXECUTION_ID}/gathersg/${MOCK_CASE_UUID}/${MOCK_ATTACHMENT_UUID}/${MOCK_ATTACHMENT_NAME}`,
      )
      .mockResolvedValueOnce(
        `s3:common-bucket:${MOCK_EXECUTION_ID}/gathersg/${MOCK_CASE_UUID}/${MOCK_ATTACHMENT_UUID_2}/${MOCK_ATTACHMENT_NAME_2}`,
      )

    await getCaseDetailsAction.run($)

    expect(httpGet).toHaveBeenCalledWith(
      '/cases/:caseUuid/attachments/:attachmentUuid',
      expect.objectContaining({
        urlPathParams: expect.objectContaining({
          attachmentUuid: MOCK_ATTACHMENT_UUID,
        }),
      }),
    )
    expect(httpGet).toHaveBeenCalledWith(
      '/cases/:caseUuid/attachments/:attachmentUuid',
      expect.objectContaining({
        urlPathParams: expect.objectContaining({
          attachmentUuid: MOCK_ATTACHMENT_UUID_2,
        }),
      }),
    )

    const call = ($.setActionItem as ReturnType<typeof vi.fn>).mock.calls[0][0]
    const attachments = call.raw.data.attachments
    expect(attachments).toHaveLength(2)
    expect(
      attachments.find((a: any) => a.attachmentUuid === MOCK_ATTACHMENT_UUID),
    ).toMatchObject({
      attachmentUuid: MOCK_ATTACHMENT_UUID,
      name: MOCK_ATTACHMENT_NAME,
      mimeType: 'application/pdf',
    })
    expect(
      attachments.find((a: any) => a.attachmentUuid === MOCK_ATTACHMENT_UUID_2),
    ).toMatchObject({
      attachmentUuid: MOCK_ATTACHMENT_UUID_2,
      name: MOCK_ATTACHMENT_NAME_2,
      mimeType: 'image/png',
    })
  })
})
