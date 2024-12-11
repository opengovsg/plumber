import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ForbiddenError } from '@/errors/graphql-errors'
import deleteFromS3 from '@/graphql/mutations/delete-from-s3'
import Flow from '@/models/flow'
import Context from '@/types/express/context'

import { generateMockContext } from './tiles/table.mock'

const mockFlowId = '8c2a70d1-e78b-431e-9069-a4d8f97883f6'
const mockBucket = 'test-bucket'
const mockObjectName = 'some-file.jpg'
const mockObjectKey = `${mockFlowId}s/${mockObjectName}`
const mockS3Id = `s3:${mockBucket}:${mockFlowId}/${mockObjectName}`

const mocks = vi.hoisted(() => ({
  s3Client: {
    send: vi.fn(() => ({
      $metadata: {
        httpStatusCode: 204,
      },
    })),
  },
  parseS3Id: vi.fn(() => ({
    bucket: mockBucket,
    objectKey: mockObjectKey,
    objectName: mockObjectName,
  })),
  PutObjectCommand: vi.fn().mockImplementation((input) => ({ input })),
}))

vi.mock('@aws-sdk/client-s3', () => ({
  S3Client: function () {
    return mocks.s3Client
  },
  PutObjectCommand: mocks.PutObjectCommand,
  GetObjectCommand: vi.fn(),
  DeleteObjectCommand: vi.fn(),
}))

describe('deleteFromS3', () => {
  let context: Context
  beforeEach(async () => {
    vi.clearAllMocks()
    context = await generateMockContext()
  })

  it('should successfully delete an object when user owns the flow', async () => {
    await Flow.query().insert({
      id: mockFlowId,
      name: 'Test Flow',
      userId: context.currentUser.id,
    })

    await expect(deleteFromS3(null, { id: mockS3Id }, context)).resolves.toBe(
      true,
    )
  })

  it('should throw an error if user does not have access to the flow', async () => {
    vi.fn()
      .mockRejectedValue(Flow.hasAccess)
      .mockRejectedValue(
        new ForbiddenError('You do not have access to this flow'),
      )

    await expect(deleteFromS3(null, { id: mockS3Id }, context)).rejects.toThrow(
      ForbiddenError,
    )
  })
})
