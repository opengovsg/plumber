import { describe, expect, it, vi } from 'vitest'

import { parseS3Id, putObject } from '../s3'

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
}))

describe('s3', () => {
  describe('parseS3Id', () => {
    it('parses valid S3 IDs', () => {
      const result = parseS3Id('s3:my-bucket:abcd/def/my file.txt')
      expect(result).toEqual({
        bucket: 'my-bucket',
        objectKey: 'abcd/def/my file.txt',
        objectName: 'my file.txt',
      })
    })

    it('returns null if input is not valid S3 ID', () => {
      expect(parseS3Id('top kek')).toBeNull()
    })

    it('handles object names with colons correctly', () => {
      const result = parseS3Id(
        's3:my-bucket:abcd/def/my-complicated filename.txt',
      )
      expect(result).toEqual({
        bucket: 'my-bucket',
        objectKey: 'abcd/def/my-complicated filename.txt',
        objectName: 'my-complicated filename.txt',
      })
    })
  })

  describe('putObject', () => {
    it("invokes AWS's s3-client's send", async () => {
      await putObject('my-bucket', 'abcd/my file.txt', 'file data bytes', null)
      expect(mocks.s3Client.send).toHaveBeenCalledOnce()
    })

    it('returns a valid S3 ID', async () => {
      const result = await putObject('my-bucket', 'abcd/my file.txt', '', null)
      expect(result).toEqual(`s3:my-bucket:abcd/my file.txt`)
    })
  })
})
