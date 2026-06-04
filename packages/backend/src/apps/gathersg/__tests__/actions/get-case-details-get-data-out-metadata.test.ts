import { IExecutionStep } from '@plumber/types'

import { describe, expect, it, vi } from 'vitest'

import getDataOutMetadata from '../../actions/get-case-details/get-data-out-metadata'

const mockObjectName = 'invoice.pdf'

const mocks = vi.hoisted(() => ({
  parseS3Id: vi.fn(() => ({
    bucket: 'common-bucket',
    objectKey: `exec/gathersg/case/attach-1/${mockObjectName}`,
    objectName: mockObjectName,
  })),
}))

vi.mock('@/helpers/s3', () => ({
  parseS3Id: mocks.parseS3Id,
}))

const minimalValidDataOut = {
  traceId: 'trace-1',
  data: {
    type: { name: 'Case type', uuid: 'type-uuid-1' },
    fields: {},
    attachments: [
      {
        attachmentUuid: 'attach-1',
        name: 'invoice.pdf',
        mimeType: 'application/octet-stream',
        size: 12,
        s3Id: 's3:common-bucket:exec/gathersg/case/attach-1/invoice.pdf',
      },
    ],
  },
}

describe('get-case-details getDataOutMetadata', () => {
  it('returns null when dataOut is missing', async () => {
    expect(await getDataOutMetadata({} as IExecutionStep)).toBeNull()
  })

  it('exposes attachment s3Id as file metadata like LetterSG', async () => {
    const step = {
      dataOut: minimalValidDataOut,
    } as unknown as IExecutionStep

    const result = await getDataOutMetadata(step)

    expect(result?.data.attachments[0]).toEqual({
      attachmentUuid: { isHidden: true },
      name: { isHidden: true },
      mimeType: { isHidden: true },
      size: { isHidden: true },
      s3Id: {
        type: 'file',
        label: 'invoice.pdf',
        displayedValue: mockObjectName,
      },
    })
    expect(mocks.parseS3Id).toHaveBeenCalledWith(
      's3:common-bucket:exec/gathersg/case/attach-1/invoice.pdf',
    )
  })

  it('omits file metadata when s3Id is absent', async () => {
    const step = {
      dataOut: {
        traceId: 'trace-1',
        data: {
          type: { name: 'Case type', uuid: 'type-uuid-1' },
          fields: {},
          attachments: [
            {
              attachmentUuid: 'attach-1',
              name: 'invoice.pdf',
              mimeType: 'application/pdf',
              size: 100,
            },
          ],
        },
      },
    } as unknown as IExecutionStep

    const result = await getDataOutMetadata(step)

    expect(result?.data.attachments[0]).toEqual({
      attachmentUuid: { isHidden: true },
      name: { isHidden: true },
      mimeType: { isHidden: true },
      size: { isHidden: true },
    })
  })

  it('returns empty attachments array when no attachments', async () => {
    const step = {
      dataOut: {
        traceId: 'trace-1',
        data: {
          type: { name: 'Case type', uuid: 'type-uuid-1' },
          fields: {},
          attachments: [],
        },
      },
    } as unknown as IExecutionStep

    const result = await getDataOutMetadata(step)

    expect(result?.data.attachments).toEqual([])
  })
})
