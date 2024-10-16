import { IExecutionStep } from '@plumber/types'

import { describe, expect, it, vi } from 'vitest'

import getDataOutMetadata from '../../actions/create-letter/get-data-out-metadata'

const mockS3ObjectName = 'letter.pdf'
const mocks = vi.hoisted(() => ({
  parseS3Id: vi.fn(() => ({
    objectName: mockS3ObjectName,
  })),
}))

vi.mock('@/helpers/s3', () => ({
  parseS3Id: mocks.parseS3Id,
}))

const mockDataOut = {
  publicId: '123',
  createdAt: '13 Mar 2024',
  letterLink: 'https://letters.gov.sg/123',
  issuedLetter: '<h1>Goodbye</h1>',
}

describe('Test getDataOutMetadata', () => {
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
