import { IExecutionStep } from '@plumber/types'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import * as s3Helpers from '@/helpers/s3'

import getDataOutMetadata from '../../actions/create-letter/get-data-out-metadata'

const mockS3ObjectName = 'letter.pdf'

const mockDataOut = {
  publicId: '123',
  createdAt: '13 Mar 2024',
  letterLink: 'https://letters.gov.sg/123',
  issuedLetter: '<h1>Goodbye</h1>',
}

describe('Test getDataOutMetadata', () => {
  beforeEach(() => {
    vi.spyOn(s3Helpers, 'parseS3Id').mockReturnValue({
      objectName: mockS3ObjectName,
    } as ReturnType<typeof s3Helpers.parseS3Id>)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('empty data test', async () => {
    const testExecutionStep = {} as unknown as IExecutionStep
    const testMetadata = await getDataOutMetadata(testExecutionStep)
    expect(testMetadata).toBeNull()
  })

  it('attachment key gets converted', async () => {
    const testExecutionStep = {
      dataOut: {
        ...mockDataOut,
        attachment: 's3:test:123/letter.pdf',
      },
    } as unknown as IExecutionStep
    const testMetadata = await getDataOutMetadata(testExecutionStep)
    expect(testMetadata.attachment.label).toEqual('Attachment')
    expect(testMetadata.attachment.type).toEqual('file')
    expect(testMetadata.attachment.displayedValue).toEqual(mockS3ObjectName)
  })

  it('default keys remain untouched', async () => {
    const testExecutionStep = {
      dataOut: {
        ...mockDataOut,
      },
    } as unknown as IExecutionStep
    const testMetadata = await getDataOutMetadata(testExecutionStep)
    expect(testMetadata.publicId.label).toEqual('publicId')
  })
})
