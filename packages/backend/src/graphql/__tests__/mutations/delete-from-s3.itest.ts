import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ForbiddenError } from '@/errors/graphql-errors'
import deleteFromS3 from '@/graphql/mutations/delete-from-s3'
import Flow from '@/models/flow'
import Context from '@/types/express/context'

import { generateMockContext } from './tiles/table.mock'
import { generateMockFlow, generateMockStep } from './flow.mock'

const mockFlowId = '8c2a70d1-e78b-431e-9069-a4d8f97883f6'
const mockBucket = 'test-bucket'
const mockObjectName = 'some-file.jpg'
const mockObjectKey = `${mockFlowId}s/${mockObjectName}`
const mockS3Id = `s3:${mockBucket}:${mockFlowId}/${mockObjectName}`

const mocks = vi.hoisted(() => ({
  s3Client: {
    send: vi.fn(() => ({
      $metadata: {
        httpStatusCode: 200,
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
  DeleteObjectsCommand: vi.fn(),
}))

function createMockS3Id(mockFileName: string) {
  return `s3:${mockBucket}:${mockFlowId}/${mockFileName}.txt`
}

async function createMockStep(
  context: Context,
  flowId: string,
  position: number,
  params: Record<string, any>,
  config: Record<string, any> = {},
) {
  return generateMockStep(
    context,
    'sendTransactionalEmail',
    'postman',
    'action',
    flowId,
    position,
    params,
    config,
  )
}

describe('deleteFromS3', () => {
  let context: Context
  beforeEach(async () => {
    vi.clearAllMocks()
    context = await generateMockContext()
  })

  it('should successfully delete an object when user owns the flow', async () => {
    await generateMockFlow(context, mockFlowId)

    await expect(deleteFromS3(null, { id: mockS3Id }, context)).resolves.toBe(
      true,
    )
  })

  it('should delete object from all other steps within a flow', async () => {
    const fileToDelete = createMockS3Id('test_1')
    await generateMockFlow(context, mockFlowId)
    await createMockStep(context, mockFlowId, 2, {
      body: 'Test body',
      attachments: [fileToDelete],
    })
    await createMockStep(context, mockFlowId, 2, {
      body: 'Test body',
      attachments: [fileToDelete, createMockS3Id('test_2')],
    })

    await deleteFromS3(null, { id: fileToDelete }, context)
    const postDeleteSteps = await context.currentUser
      .$relatedQuery('steps')
      .where({ flow_id: mockFlowId })

    postDeleteSteps.forEach((step) => {
      expect(step.parameters.attachments).not.toContain(fileToDelete)
    })
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
