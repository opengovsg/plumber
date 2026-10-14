import type { IGlobalVariable } from '@plumber/types'

import type { FormField } from '@opengovsg/formsg-sdk/dist/types'
import { describe, expect, it, vi } from 'vitest'

import storeAttachmentInS3 from '../../auth/helpers/store-attachment-in-s3'

const mocks = vi.hoisted(() => ({
  putObject: vi.fn(),
}))

vi.mock('@/helpers/s3', () => ({
  ATTACHMENT_TYPE: { TRANSITIVE: 'transitive', TEST: 'test' },
  buildAttachmentTypeTagging: vi.fn(),
  COMMON_S3_BUCKET: 'bucket',
  putObject: mocks.putObject,
}))

const formField = {
  _id: 'file1',
  question: 'Upload',
  fieldType: 'attachment',
  answer: '',
} as FormField

describe('storeAttachmentInS3', () => {
  it('returns an empty string when the payload has no attachment map', async () => {
    const result = await storeAttachmentInS3(
      {} as IGlobalVariable,
      'submission',
      formField,
      null,
    )

    expect(result).toBe('')
    expect(mocks.putObject).not.toHaveBeenCalled()
  })
})
