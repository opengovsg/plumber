import { IGlobalVariable } from '@plumber/types'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { AttachmentSizeExceededError } from '../../common/attachment-size'
import { filterAttachments } from '../../common/parameters-helper'

const mocks = vi.hoisted(() => ({
  openObjectFromS3Id: vi.fn(),
}))

vi.mock('@/helpers/s3', async () => {
  const actual =
    await vi.importActual<typeof import('@/helpers/s3')>('@/helpers/s3')
  return {
    ...actual,
    openObjectFromS3Id: mocks.openObjectFromS3Id,
  }
})

const MB = 1024 * 1024

function makeObject(name: string, sizeInBytes: number | undefined) {
  return {
    name,
    sizeInBytes,
    read: vi.fn(async () => new Uint8Array([1])),
    discard: vi.fn(),
  }
}

const $ = {
  flow: { id: 'flow-id' },
  execution: { testRun: false },
} as unknown as IGlobalVariable

function run(attachmentsList: string[]) {
  return filterAttachments({
    $,
    attachmentsList,
    isPartialRetry: false,
    lastExecutionStep: null,
    extensionPolicy: { mode: 'allow', extensions: ['pdf'] },
  })
}

describe('filterAttachments', () => {
  let objects: Record<string, ReturnType<typeof makeObject>>

  beforeEach(() => {
    objects = {}
    mocks.openObjectFromS3Id.mockReset()
    mocks.openObjectFromS3Id.mockImplementation(async (id: string) => {
      const obj = objects[id]
      if (!obj) {
        throw new Error(`S3 metadata mismatch for ${id}`)
      }
      return obj
    })
  })

  it('downloads a repeated attachment once', async () => {
    objects['s3:b:1/a.pdf'] = makeObject('a.pdf', MB)

    const result = await run(['s3:b:1/a.pdf', 's3:b:1/a.pdf', 's3:b:1/a.pdf'])

    expect(mocks.openObjectFromS3Id).toHaveBeenCalledOnce()
    expect(result.attachmentFiles).toHaveLength(1)
  })

  it('reads attachments within the total size limit', async () => {
    objects['s3:b:1/a.pdf'] = makeObject('a.pdf', 10 * MB)
    objects['s3:b:1/b.pdf'] = makeObject('b.pdf', 10 * MB)

    const result = await run(['s3:b:1/a.pdf', 's3:b:1/b.pdf'])

    expect(result.attachmentFiles.map((f) => f.fileName)).toEqual([
      'a.pdf',
      'b.pdf',
    ])
  })

  it('rejects before reading any attachment when the total size is too large', async () => {
    objects['s3:b:1/a.pdf'] = makeObject('a.pdf', 10 * MB)
    objects['s3:b:1/b.pdf'] = makeObject('b.pdf', 10 * MB + 1)

    await expect(run(['s3:b:1/a.pdf', 's3:b:1/b.pdf'])).rejects.toThrow(
      AttachmentSizeExceededError,
    )
    for (const obj of Object.values(objects)) {
      expect(obj.read).not.toHaveBeenCalled()
      expect(obj.discard).toHaveBeenCalledOnce()
    }
  })

  it('treats an attachment with an unknown size as too large', async () => {
    objects['s3:b:1/a.pdf'] = makeObject('a.pdf', undefined)

    await expect(run(['s3:b:1/a.pdf'])).rejects.toThrow(
      AttachmentSizeExceededError,
    )
    expect(objects['s3:b:1/a.pdf'].read).not.toHaveBeenCalled()
  })

  it('excludes unsupported attachments from the size total without reading them', async () => {
    objects['s3:b:1/a.pdf'] = makeObject('a.pdf', MB)
    objects['s3:b:1/big.exe'] = makeObject('big.exe', 100 * MB)

    const result = await run(['s3:b:1/a.pdf', 's3:b:1/big.exe'])

    expect(result.attachmentFiles.map((f) => f.fileName)).toEqual(['a.pdf'])
    expect(result.invalidAttachments).toEqual(['big.exe'])
    expect(objects['s3:b:1/big.exe'].read).not.toHaveBeenCalled()
    expect(objects['s3:b:1/big.exe'].discard).toHaveBeenCalledOnce()
  })

  it('discards opened attachments when another attachment fails to open', async () => {
    objects['s3:b:1/a.pdf'] = makeObject('a.pdf', MB)

    await expect(run(['s3:b:1/a.pdf', 's3:b:1/missing.pdf'])).rejects.toThrow(
      'S3 metadata mismatch',
    )
    expect(objects['s3:b:1/a.pdf'].read).not.toHaveBeenCalled()
    expect(objects['s3:b:1/a.pdf'].discard).toHaveBeenCalledOnce()
  })
})
