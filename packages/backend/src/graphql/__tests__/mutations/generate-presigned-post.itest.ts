import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ForbiddenError } from '@/errors/graphql-errors'
import { generateMockContext } from '@/graphql/__tests__/mutations/tiles/table.mock'
import generatePresignedPost from '@/graphql/mutations/generate-presigned-post'
import Flow from '@/models/flow'
import Context from '@/types/express/context'

const VALID_PARAMS = {
  flowId: '193040de-c818-4a0c-90f9-1dcfb1963f53',
  filename: 'test.txt',
  fileType: 'text/plain',
  size: 100,
  updatedAt: new Date().toISOString(),
}

// Mock the s3 helpers module
vi.mock('@/helpers/s3', () => ({
  getPresignedPost: vi.fn(),
  COMMON_S3_BUCKET: 'test-bucket',
  COMMON_S3_MOCK_FOLDER_PREFIX: 's3:test-bucket:mock/',
  parseS3Id: vi.fn(),
  MAX_FILE_SIZE: 1024 * 1024 * 2,
  ACCEPTED_FILE_TYPES: ['text/plain'],
  validateObjectKey: vi.fn((objectKey) => {
    const invalidCharacters = /[\\{}^`%~#<>|[\]]/
    if (invalidCharacters.test(objectKey)) {
      return false
    }

    // validate length of object key
    const byteLength = Buffer.byteLength(objectKey, 'utf-8')
    return byteLength <= 1024
  }),
}))

import { COMMON_S3_BUCKET, getPresignedPost } from '@/helpers/s3'

describe('generatePresignedPost', () => {
  let context: Context
  beforeEach(async () => {
    context = await generateMockContext()
    vi.clearAllMocks()
  })

  it('should generate a presigned url', async () => {
    await Flow.query().insert({
      id: VALID_PARAMS.flowId,
      name: 'Test Flow',
      userId: context.currentUser.id,
    })

    await generatePresignedPost(null, { input: VALID_PARAMS }, context)
    expect(getPresignedPost).toHaveBeenCalledWith(
      COMMON_S3_BUCKET,
      expect.stringMatching(
        new RegExp(
          `^${VALID_PARAMS.flowId}/[a-f0-9-]+/${VALID_PARAMS.filename}$`,
        ),
      ),
      VALID_PARAMS.fileType,
      {
        flowId: VALID_PARAMS.flowId,
        filename: VALID_PARAMS.filename,
        size: VALID_PARAMS.size.toString(),
        updatedAt: VALID_PARAMS.updatedAt,
      },
    )
  })

  it('should throw an error if the user does not have access to the flow', async () => {
    const otherUserContext = await generateMockContext()
    await Flow.query()
      .patch({
        userId: otherUserContext.currentUser.id,
      })
      .where('id', VALID_PARAMS.flowId)

    await expect(
      generatePresignedPost(null, { input: VALID_PARAMS }, context),
    ).rejects.toThrow(ForbiddenError)
  })

  it('should throw an error if the file size is too large', async () => {
    await Flow.query().insert({
      id: VALID_PARAMS.flowId,
      name: 'Test Flow',
      userId: context.currentUser.id,
    })

    const tooLargeParams = { ...VALID_PARAMS, size: 2 * 1024 * 1024 + 1 }
    await expect(
      generatePresignedPost(null, { input: tooLargeParams }, context),
    ).rejects.toThrow('Size of attachment exceeds 2MB')
  })

  it.each([
    'application/octet-stream',
    'application/x-executable',
    'application/x-shockwave-flash',
    'application/x-msdownload',
  ])(
    'should throw an error if the file type is not supported: %s',
    async (fileType) => {
      await Flow.query().insert({
        id: VALID_PARAMS.flowId,
        name: 'Test Flow',
        userId: context.currentUser.id,
      })

      const unsupportedParams = {
        ...VALID_PARAMS,
        fileType,
      }

      await expect(
        generatePresignedPost(null, { input: unsupportedParams }, context),
      ).rejects.toThrow('Unsupported file type')
    },
  )
})
