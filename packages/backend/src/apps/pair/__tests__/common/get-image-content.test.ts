import { afterEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getObjectFromS3Id: vi.fn(),
}))

vi.mock('@/helpers/s3', async (importOriginal) => {
  // No reason to mock other things like parseS3Id/COMMON_S3_BUCKET
  const actual = await importOriginal<typeof import('@/helpers/s3')>()
  return {
    ...actual,
    getObjectFromS3Id: mocks.getObjectFromS3Id,
  }
})

import { getImageContent } from '@/apps/pair/common/get-image-content'
import { COMMON_S3_BUCKET } from '@/helpers/s3'

describe('getImageContent', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it("scopes the S3 lookup to the calling flow's id", async () => {
    mocks.getObjectFromS3Id.mockResolvedValue({
      name: 'image.png',
      data: new Uint8Array([1, 2, 3]),
    })

    await getImageContent(`s3:${COMMON_S3_BUCKET}:key`, 'flow-id')

    expect(mocks.getObjectFromS3Id).toHaveBeenCalledWith(
      `s3:${COMMON_S3_BUCKET}:key`,
      { flowId: 'flow-id' },
    )
  })

  it('rejects an S3 object belonging to a different flow', async () => {
    mocks.getObjectFromS3Id.mockRejectedValue(
      new Error(
        'S3 metadata mismatch for key: expected flowId=flow-id, got other-flow-id',
      ),
    )

    await expect(
      getImageContent(`s3:${COMMON_S3_BUCKET}:key`, 'flow-id'),
    ).rejects.toThrow(/S3 metadata mismatch/)
  })

  it('rejects an S3 id pointing at a bucket other than the app bucket', async () => {
    await expect(
      getImageContent('s3:some-other-bucket:key', 'flow-id'),
    ).rejects.toThrow(/Invalid S3 ID/)

    expect(mocks.getObjectFromS3Id).not.toHaveBeenCalled()
  })

  it('rejects a malformed S3 id', async () => {
    await expect(getImageContent('not-an-s3-id', 'flow-id')).rejects.toThrow(
      /Invalid S3 ID/,
    )

    expect(mocks.getObjectFromS3Id).not.toHaveBeenCalled()
  })
})
