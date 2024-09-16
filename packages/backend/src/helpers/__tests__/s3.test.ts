import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  COMMON_S3_BUCKET,
  COMMON_S3_MOCK_FOLDER_PREFIX,
  getObjectFromS3Id,
  parseS3Id,
  putObject,
} from '../s3'

const mocks = vi.hoisted(() => ({
  s3Client: {
    send: vi.fn(),
  },
}))

vi.mock('@aws-sdk/client-s3', () => ({
  // Mocking constructor; cannot use arrow functions
  S3Client: function () {
    return mocks.s3Client
  },
  PutObjectCommand: vi.fn(),
  GetObjectCommand: vi.fn(),
}))

describe('s3', () => {
  afterEach(() => {
    vi.resetAllMocks()
  })

  describe('parseS3Id', () => {
    it('parses valid S3 IDs', () => {
      const result = parseS3Id(`s3:${COMMON_S3_BUCKET}:abcd/def/my file.txt`)
      expect(result).toEqual({
        bucket: COMMON_S3_BUCKET,
        objectKey: 'abcd/def/my file.txt',
        objectName: 'my file.txt',
      })
    })

    it('returns null if input is not valid S3 ID', () => {
      expect(parseS3Id('top kek')).toBeNull()
    })

    it('handles object names with colons correctly', () => {
      const result = parseS3Id(
        `s3:${COMMON_S3_BUCKET}:abcd/def/my-complicated filename.txt`,
      )
      expect(result).toEqual({
        bucket: COMMON_S3_BUCKET,
        objectKey: 'abcd/def/my-complicated filename.txt',
        objectName: 'my-complicated filename.txt',
      })
    })

    it('should throw an error if path traversal is detected', () => {
      expect(() =>
        parseS3Id(`s3:${COMMON_S3_BUCKET}:abcd/../my file.txt`),
      ).toThrowError(
        'Invalid S3 ID: path traversal detected in abcd/../my file.txt',
      )
    })
  })

  describe('putObject', () => {
    it("invokes AWS's s3-client's send", async () => {
      await putObject(
        COMMON_S3_BUCKET,
        'abcd/my file.txt',
        'file data bytes',
        null,
      )
      expect(mocks.s3Client.send).toHaveBeenCalledOnce()
    })

    it('returns a valid S3 ID', async () => {
      const result = await putObject(
        COMMON_S3_BUCKET,
        'abcd/my file.txt',
        '',
        null,
      )
      expect(result).toEqual(`s3:${COMMON_S3_BUCKET}:abcd/my file.txt`)
    })
  })

  describe('getObjectFromS3Id', () => {
    beforeEach(() => {
      mocks.s3Client.send.mockResolvedValueOnce({
        Body: {
          transformToByteArray: vi.fn(() => 'file data bytes'),
        },
        Metadata: {
          flowId: 'flow-id',
          stepId: 'step-id',
          executionId: 'execution-id',
          publicId: 'public-id',
        },
      })
    })

    it('should fetch object from S3 successfully when no metadat is provided', async () => {
      await getObjectFromS3Id(`s3:${COMMON_S3_BUCKET}:abcd/my file.txt`)
      expect(mocks.s3Client.send).toHaveBeenCalledOnce()
    })

    it('should return object body if provided metadata matches subset of stored metadata', async () => {
      const result = await getObjectFromS3Id(
        `s3:${COMMON_S3_BUCKET}:abcd/my file.txt`,
        {
          flowId: 'flow-id',
        },
      )
      expect(result).toEqual({
        name: 'my file.txt',
        data: 'file data bytes',
      })
    })

    it('should throw an error if metadata does not match', async () => {
      await expect(
        getObjectFromS3Id(`s3:${COMMON_S3_BUCKET}:abcd/my file.txt`, {
          flowId: 'wrong',
        }),
      ).rejects.toThrowError(
        `S3 metadata mismatch for s3:${COMMON_S3_BUCKET}:abcd/my file.txt: expected flowId=wrong, got flow-id`,
      )
    })

    it('should ignore metadata check for files in mock folder', async () => {
      await expect(
        getObjectFromS3Id(`${COMMON_S3_MOCK_FOLDER_PREFIX}my file.txt`, {
          flowId: 'wrong',
        }),
      ).resolves.toEqual({
        name: 'my file.txt',
        data: 'file data bytes',
      })
    })
  })
})
