import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ForbiddenError } from '@/errors/graphql-errors'
import { generateMockContext } from '@/graphql/__tests__/mutations/tiles/table.mock'
import generatePresignedUrl from '@/graphql/mutations/generate-presigned-url'
import Flow from '@/models/flow'
import Context from '@/types/express/context'

const VALID_PARAMS = {
  flowId: '193040de-c818-4a0c-90f9-1dcfb1963f53',
  filename: 'test.txt',
  fileType: 'text/plain',
  size: 100,
  updatedAt: new Date().toISOString(),
  manualUpload: true,
}

const mocks = vi.hoisted(() => ({
  getSignedUrl: vi.fn(),
}))

vi.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: mocks.getSignedUrl,
}))

describe('generatePresignedUrl', () => {
  let context: Context
  beforeEach(async () => {
    context = await generateMockContext()
  })

  it('should generate a presigned url', async () => {
    const expectedUrl = 'https://presigned-url.example.com'
    mocks.getSignedUrl.mockResolvedValueOnce(expectedUrl)

    await Flow.query().insert({
      id: VALID_PARAMS.flowId,
      name: 'Test Flow',
      userId: context.currentUser.id,
    })

    const result = await generatePresignedUrl(
      null,
      { input: VALID_PARAMS },
      context,
    )
    const expectedKeys = ['url', 's3Id']
    expect(Object.keys(result)).toEqual(expectedKeys)
    expect(result.s3Id).toContain(VALID_PARAMS.flowId)
  })

  it('should throw an error if the user does not have access to the flow', async () => {
    vi.fn()
      .mockRejectedValue(Flow.hasAccess)
      .mockRejectedValue(
        new ForbiddenError('You do not have access to this flow'),
      )

    await expect(
      generatePresignedUrl(null, { input: VALID_PARAMS }, context),
    ).rejects.toThrow(ForbiddenError)
  })
})
