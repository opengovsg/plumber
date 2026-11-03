import type { IGlobalVariable } from '@plumber/types'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { makeHttpError } from '../../../../../test/utils/make-http-error'
import { processAttachments } from '../../common/attachment'

const mocks = vi.hoisted(() => ({
  putObject: vi.fn(),
}))

vi.mock('@/helpers/s3', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/helpers/s3')>()
  return {
    ...actual,
    COMMON_S3_BUCKET: 'common-bucket',
    MAX_FILE_SIZE: 1024 * 1024,
    putObject: mocks.putObject,
  }
})

const MOCK_CASE_UUID = 'Aa1Bb2Cc3Dd4Ee5Ff6Gg7H'
const MOCK_ATTACHMENTS = {
  'attach-uuid-1': {
    name: 'invoice.pdf',
    mimeType: 'application/pdf',
    size: 12,
  },
}

describe('processAttachments', () => {
  let $: IGlobalVariable
  let httpGet: ReturnType<typeof vi.fn>

  beforeEach(() => {
    mocks.putObject.mockReset()
    mocks.putObject.mockResolvedValue('s3:common-bucket:key')
    httpGet = vi.fn(async () => ({ data: Buffer.from('file-content') }))

    $ = {
      execution: { id: 'execution-id-123' },
      flow: { id: 'flow-id-123' },
      step: { id: 'step-id-123', appKey: 'gathersg' },
      http: { get: httpGet } as unknown as IGlobalVariable['http'],
    } as unknown as IGlobalVariable
  })

  it('tags an attachment over the size limit as config', async () => {
    await expect(
      processAttachments($, MOCK_CASE_UUID, {
        'attach-uuid-1': {
          ...MOCK_ATTACHMENTS['attach-uuid-1'],
          size: 2 * 1024 * 1024,
        },
      }),
    ).rejects.toMatchObject({
      kind: 'config',
      message: expect.stringContaining('exceeds maximum size'),
    })
    expect(httpGet).not.toHaveBeenCalled()
  })

  it.each([401, 403])('tags a %s download as config', async (status) => {
    const error = makeHttpError({ status, data: { error: { message: 'x' } } })
    httpGet.mockRejectedValueOnce(error)

    await expect(
      processAttachments($, MOCK_CASE_UUID, MOCK_ATTACHMENTS),
    ).rejects.toMatchObject({ kind: 'config', cause: error })
  })

  it('tags a 429 download as internal and keeps the cause', async () => {
    const error = makeHttpError({ status: 429 })
    httpGet.mockRejectedValueOnce(error)

    await expect(
      processAttachments($, MOCK_CASE_UUID, MOCK_ATTACHMENTS),
    ).rejects.toMatchObject({ kind: 'internal', cause: error })
  })

  it.each([
    ['a 404', { status: 404 }],
    ['a 504', { status: 504, data: '<html>Gateway Timeout</html>' }],
    ['a network error', { code: 'ETIMEDOUT', message: 'timeout' }],
  ])('tags %s download as third-party', async (_label, options) => {
    const error = makeHttpError(options)
    httpGet.mockRejectedValueOnce(error)

    await expect(
      processAttachments($, MOCK_CASE_UUID, MOCK_ATTACHMENTS),
    ).rejects.toMatchObject({ kind: 'third-party', cause: error })
  })

  it('tags an S3 upload failure as internal', async () => {
    mocks.putObject.mockRejectedValueOnce(new Error('S3 down'))

    await expect(
      processAttachments($, MOCK_CASE_UUID, MOCK_ATTACHMENTS),
    ).rejects.toMatchObject({
      kind: 'internal',
      message: expect.stringContaining('Failed to process attachment'),
    })
  })

  it('tags a malformed attachments payload as third-party', async () => {
    await expect(
      processAttachments($, MOCK_CASE_UUID, {
        'attach-uuid-1': { name: '' },
      }),
    ).rejects.toMatchObject({
      kind: 'third-party',
      message: expect.stringContaining('Invalid attachments'),
    })
  })
})
