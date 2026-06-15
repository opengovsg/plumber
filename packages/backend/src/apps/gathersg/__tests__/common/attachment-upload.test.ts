import type { IGlobalVariable } from '@plumber/types'

import axios from 'axios'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import HttpError from '@/errors/http'
import * as s3 from '@/helpers/s3'

import {
  generateUploadToken,
  uploadCaseAttachments,
  uploadFileToGather,
} from '../../common/attachment'

vi.mock('axios')

const MOCK_CASE_UUID = '1234567890abcdefghijkl'
const MOCK_S3_ID = 's3:plumber-bucket:flow-id-123/abc/photo.png'

const mocks = vi.hoisted(() => ({
  httpPost: vi.fn(),
}))

describe('gathersg attachment upload helpers', () => {
  let $: IGlobalVariable

  beforeEach(() => {
    $ = {
      flow: { id: 'flow-id-123' },
      http: { post: mocks.httpPost } as unknown as IGlobalVariable['http'],
    } as unknown as IGlobalVariable
    mocks.httpPost.mockResolvedValue({ data: { data: { token: 'tok-123' } } })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('generateUploadToken', () => {
    it('posts to /cases/upload/token and returns the token', async () => {
      const token = await generateUploadToken($, {
        field: 'photos',
        type: 'attachment',
        caseUuid: MOCK_CASE_UUID,
      })

      expect(mocks.httpPost).toHaveBeenCalledWith('/cases/upload/token', {
        field: 'photos',
        type: 'attachment',
        uuid: MOCK_CASE_UUID,
      })
      expect(token).toBe('tok-123')
    })
  })

  describe('uploadFileToGather', () => {
    it('uploads with bearer token to the file-api and returns file data', async () => {
      vi.mocked(axios.post).mockResolvedValue({
        data: {
          data: {
            uuid: 'file-uuid-1',
            name: 'photo.png',
            mimeType: 'image/png',
            size: 10,
            expireAt: '2026-07-01',
          },
        },
      })

      const result = await uploadFileToGather('tok-123', {
        name: 'photo.png',
        data: new Uint8Array([1, 2, 3]),
      })

      expect(axios.post).toHaveBeenCalledWith(
        'https://gather.gov.sg/file/api/upload',
        expect.anything(),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer tok-123',
          }),
        }),
      )
      expect(result.uuid).toBe('file-uuid-1')
    })

    it('wraps a file-api error in HttpError', async () => {
      const axiosError = {
        isAxiosError: true,
        message: 'Request failed',
        response: { data: { error: { message: 'bad' } }, status: 400 },
        config: {},
      }
      vi.mocked(axios.post).mockRejectedValue(axiosError)

      await expect(
        uploadFileToGather('tok-123', {
          name: 'photo.png',
          data: new Uint8Array([1]),
        }),
      ).rejects.toBeInstanceOf(HttpError)
    })
  })

  describe('uploadCaseAttachments', () => {
    it('fetches files from S3, mints one token, uploads each, returns uuids', async () => {
      vi.spyOn(s3, 'getObjectFromS3Id').mockResolvedValue({
        name: 'photo.png',
        data: new Uint8Array([1, 2, 3]),
      })
      vi.mocked(axios.post)
        .mockResolvedValueOnce({ data: { data: { uuid: 'u1' } } })
        .mockResolvedValueOnce({ data: { data: { uuid: 'u2' } } })

      const uuids = await uploadCaseAttachments({
        $,
        caseUuid: MOCK_CASE_UUID,
        field: 'photos',
        fieldType: 'attachment',
        s3Ids: [MOCK_S3_ID, MOCK_S3_ID],
      })

      expect(s3.getObjectFromS3Id).toHaveBeenCalledWith(MOCK_S3_ID, {
        flowId: 'flow-id-123',
      })
      expect(mocks.httpPost).toHaveBeenCalledTimes(1)
      expect(axios.post).toHaveBeenCalledTimes(2)
      expect(uuids).toEqual(['u1', 'u2'])
    })

    it('returns empty array when no s3 ids', async () => {
      const uuids = await uploadCaseAttachments({
        $,
        caseUuid: MOCK_CASE_UUID,
        field: 'photos',
        fieldType: 'attachment',
        s3Ids: [],
      })
      expect(uuids).toEqual([])
      expect(mocks.httpPost).not.toHaveBeenCalled()
    })

    it('throws a StepError when a file exceeds MAX_FILE_SIZE', async () => {
      vi.spyOn(s3, 'getObjectFromS3Id').mockResolvedValue({
        name: 'big.png',
        data: new Uint8Array(11 * 1024 * 1024),
      })

      await expect(
        uploadCaseAttachments({
          $,
          caseUuid: MOCK_CASE_UUID,
          field: 'photos',
          fieldType: 'attachment',
          s3Ids: [MOCK_S3_ID],
        }),
      ).rejects.toThrow('exceeds maximum size')
    })
  })
})
