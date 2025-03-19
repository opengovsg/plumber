import { ObjectIdentifier } from '@aws-sdk/client-s3'
import { randomUUID } from 'crypto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  checkObjectScanStatus,
  COMMON_S3_BUCKET,
  COMMON_S3_MOCK_FOLDER_PREFIX,
  deleteObjects,
  getObjectFromS3Id,
  getPresignedUrl,
  MALWARE_SCAN_STATUS,
  parseS3Id,
  putObject,
  validateManualUploadId,
  validateObjectKey,
} from '../s3'

const VALID_PUT_OBJ_INPUTS = {
  Bucket: COMMON_S3_BUCKET,
  Key: 'test/file.txt',
  Metadata: {
    contentType: 'text/plain',
  },
}

const mocks = vi.hoisted(() => ({
  s3Client: {
    send: vi.fn(),
  },
  getPresignedUrl: vi.fn(),
  PutObjectCommand: vi.fn().mockImplementation((input) => ({ input })),
  GetObjectTaggingCommand: vi.fn(),
}))

vi.mock('@aws-sdk/client-s3', () => ({
  // Mocking constructor; cannot use arrow functions
  S3Client: function () {
    return mocks.s3Client
  },
  PutObjectCommand: mocks.PutObjectCommand,
  GetObjectCommand: vi.fn(),
  DeleteObjectCommand: vi.fn(),
  DeleteObjectsCommand: vi.fn(),
  GetObjectTaggingCommand: mocks.GetObjectTaggingCommand,
}))

vi.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: mocks.getPresignedUrl,
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
          flowid: 'flow-id',
          stepid: 'step-id',
          executionid: 'execution-id',
        },
      })
    })

    it('should fetch object from S3 successfully when no metadata is provided', async () => {
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
        `S3 metadata mismatch for abcd/my file.txt: expected flowId=wrong, got flow-id`,
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

  describe('getPresignedUrl', () => {
    beforeEach(() => {
      vi.clearAllMocks()
    })

    it('should generate a presigned URL successfully', async () => {
      const expectedUrl = 'https://presigned-url.example.com'
      mocks.getPresignedUrl.mockResolvedValueOnce(expectedUrl)

      const result = await getPresignedUrl(
        COMMON_S3_BUCKET,
        'test/file.txt',
        'text/plain',
        {
          contentType: 'text/plain',
        },
      )

      expect(result).toBe(expectedUrl)
      const putObjectCommand = new mocks.PutObjectCommand(VALID_PUT_OBJ_INPUTS)
      expect(mocks.getPresignedUrl).toHaveBeenCalledWith(
        mocks.s3Client,
        putObjectCommand,
        { expiresIn: 5 * 60 },
      )
    })

    it('should handle null metadata', async () => {
      const expectedUrl = 'https://presigned-url.example.com'
      mocks.getPresignedUrl.mockResolvedValueOnce(expectedUrl)

      const result = await getPresignedUrl(
        COMMON_S3_BUCKET,
        'test/file.txt',
        'text/plain',
        null,
      )

      expect(result).toBe(expectedUrl)
      const putObjectCommand = new mocks.PutObjectCommand(VALID_PUT_OBJ_INPUTS)
      expect(mocks.getPresignedUrl).toHaveBeenCalledWith(
        mocks.s3Client,
        putObjectCommand,
        { expiresIn: 5 * 60 },
      )
    })

    it('should throw error when URL generation fails', async () => {
      mocks.getPresignedUrl.mockRejectedValueOnce(
        new Error('Failed to generate presigned URL'),
      )

      await expect(
        getPresignedUrl(COMMON_S3_BUCKET, 'test/file.txt', 'text/plain', null),
      ).rejects.toThrow('Failed to generate presigned URL')
    })
  })

  describe('deleteObjects', () => {
    afterEach(() => {
      vi.resetAllMocks()
    })

    it('should return true when deletion is successful', async () => {
      mocks.s3Client.send.mockResolvedValueOnce({
        $metadata: { httpStatusCode: 200 },
      })

      const result = await deleteObjects(COMMON_S3_BUCKET, [
        { Key: 'abcd/my file.txt' },
      ])
      expect(result).toBe(true)
    })

    it('should throw error when deletion returns non-200 status', async () => {
      mocks.s3Client.send.mockResolvedValueOnce({
        $metadata: { httpStatusCode: 500 },
      })
      await expect(
        deleteObjects(COMMON_S3_BUCKET, [{ Key: 'abcd/my file.txt' }]),
      ).rejects.toThrow('Error deleting object')
    })

    it('should throw error when bucket does not exist', async () => {
      mocks.s3Client.send.mockRejectedValueOnce(
        new Error('NoSuchBucket: The specified bucket does not exist'),
      )
      await expect(
        deleteObjects('non-existent-bucket', [{ Key: 'abcd/my file.txt' }]),
      ).rejects.toThrow(
        'Error deleting object: NoSuchBucket: The specified bucket does not exist',
      )
    })

    it('should throw error when objectKeys are invalid', async () => {
      await expect(
        deleteObjects(COMMON_S3_BUCKET, [
          'abcd/my file.txt' as unknown as ObjectIdentifier,
        ]),
      ).rejects.toThrow('Error deleting object')
    })

    it('should throw error when access is denied', async () => {
      mocks.s3Client.send.mockRejectedValueOnce(
        new Error('AccessDenied: Access Denied'),
      )
      await expect(
        deleteObjects(COMMON_S3_BUCKET, [{ Key: 'abcd/my file.txt' }]),
      ).rejects.toThrow('Error deleting object: AccessDenied: Access Denied')
    })
  })

  describe('checkObjectScanStatus', () => {
    it('should return true when attachment scan result is NO_THREATS_FOUND', async () => {
      mocks.s3Client.send.mockResolvedValueOnce({
        TagSet: [
          {
            Key: 'GuardDutyMalwareScanStatus',
            Value: MALWARE_SCAN_STATUS.NO_THREATS_FOUND,
          },
        ],
      })

      const result = await checkObjectScanStatus(
        COMMON_S3_BUCKET,
        'abcd/my file.txt',
      )

      expect(mocks.s3Client.send).toHaveBeenCalledOnce()
      expect(result).toEqual({ isValid: true })
    })

    it('should return error when attachment scan result is in progress', async () => {
      mocks.s3Client.send.mockResolvedValueOnce({
        TagSet: [],
      })

      const result = await checkObjectScanStatus(
        COMMON_S3_BUCKET,
        'abcd/my file.txt',
      )

      expect(mocks.s3Client.send).toHaveBeenCalledOnce()
      expect(result).toEqual({
        isValid: false,
        scanStatus: MALWARE_SCAN_STATUS.PENDING,
      })
    })

    const testTagValues = [
      MALWARE_SCAN_STATUS.THREATS_FOUND,
      MALWARE_SCAN_STATUS.UNSUPPORTED,
      MALWARE_SCAN_STATUS.ACCESS_DENIED,
      MALWARE_SCAN_STATUS.FAILED,
    ]
    testTagValues.forEach((status) => {
      it(`should return false and throw error when attachment scan result is ${status}`, async () => {
        mocks.s3Client.send.mockResolvedValueOnce({
          TagSet: [
            {
              Key: 'GuardDutyMalwareScanStatus',
              Value: status,
            },
          ],
        })

        const result = await checkObjectScanStatus(
          COMMON_S3_BUCKET,
          'abcd/my file.txt',
        )

        expect(mocks.s3Client.send).toHaveBeenCalledOnce()
        expect(result).toEqual({
          isValid: false,
          scanStatus: status,
        })
      })
    })
  })

  describe('validateObjectKey', () => {
    it('should return true for an object key with byte length less than or equal to 1024', () => {
      const validKey = 'a'.repeat(1024)
      expect(validateObjectKey(validKey)).toBe(true)
    })

    it('should return false for an object key with byte length greater than 1024', () => {
      const invalidKey = 'a'.repeat(1025)
      expect(validateObjectKey(invalidKey)).toBe(false)
    })

    it('should return true for an empty object key', () => {
      const emptyKey = ''
      expect(validateObjectKey(emptyKey)).toBe(true)
    })

    it('should correctly handle multibyte characters', () => {
      const multibyteKey = 'ü'.repeat(512) // Each 'ü' is 2 bytes in UTF-8
      expect(validateObjectKey(multibyteKey)).toBe(true)

      const invalidMultibyteKey = 'ü'.repeat(513) // 1026 bytes
      expect(validateObjectKey(invalidMultibyteKey)).toBe(false)
    })

    it('should return false for object keys with invalid characters', () => {
      const invalidKeys = [
        'key\\with\\backslash',
        'key{with}braces',
        'key^with^caret',
        'key%with%percent',
        'key<with<less',
        'key>with>greater',
        'key#with#hash',
        'key|with|pipe',
        'key~with~tilde',
        'key`with`backtick',
        'key[with[square',
        'key]with]square',
      ]
      invalidKeys.forEach((key) => {
        expect(validateObjectKey(key)).toBe(false)
      })
    })
  })

  describe('validateS3IdFormat', () => {
    it('should return true for a valid S3 ID format', () => {
      const validId = `s3:bucket-name:${randomUUID()}/${randomUUID()}/filename.txt`
      expect(validateManualUploadId(validId)).toBe(true)
    })

    it('should return false for an invalid S3 ID format', () => {
      const invalidIds = [
        's3:bucket-name:invalid-uuid/invalid-uuid/filename.txt',
        's3:bucket-name:1234/5678/filename.txt',
        's3:bucket-name:uuid/uuid',
        's3:bucket-name:uuid/uuid/',
        's3:bucket-name:/uuid/filename.txt',
        'bucket-name:uuid/uuid/filename.txt',
        's3:bucket-name:uuid/uuid/filename',
        '{{step.12345678.fields.987654321abc.answer}}',
      ]
      invalidIds.forEach((id) => {
        expect(validateManualUploadId(id)).toBe(false)
      })
    })
  })
})
