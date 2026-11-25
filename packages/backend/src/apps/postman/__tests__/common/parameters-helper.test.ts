import { IGlobalVariable } from '@plumber/types'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { filterAttachments } from '../../common/parameters-helper'

const mocks = vi.hoisted(() => ({
  headObjectFromS3Id: vi.fn(),
}))

vi.mock('@/helpers/s3', async () => {
  const actual =
    await vi.importActual<typeof import('@/helpers/s3')>('@/helpers/s3')
  return {
    ...actual,
    headObjectFromS3Id: mocks.headObjectFromS3Id,
  }
})

const MB = 1024 * 1024

function makeObject(name: string, sizeInBytes: number | undefined) {
  return {
    name,
    sizeInBytes,
    read: vi.fn(async () => new Uint8Array([1])),
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
    mocks.headObjectFromS3Id.mockReset()
    mocks.headObjectFromS3Id.mockImplementation(async (id: string) => {
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

    expect(mocks.headObjectFromS3Id).toHaveBeenCalledOnce()
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

    const result = await run(['s3:b:1/a.pdf', 's3:b:1/b.pdf'])

    expect(result.totalSizeExceeded).toBe(true)
    expect(result.attachmentFiles).toEqual([])
    for (const obj of Object.values(objects)) {
      expect(obj.read).not.toHaveBeenCalled()
    }
  })

  it('treats an attachment with an unknown size as too large', async () => {
    objects['s3:b:1/a.pdf'] = makeObject('a.pdf', undefined)

    const result = await run(['s3:b:1/a.pdf'])

    expect(result.totalSizeExceeded).toBe(true)
    expect(objects['s3:b:1/a.pdf'].read).not.toHaveBeenCalled()
  })

  it('still reports invalid attachments when the total size is too large', async () => {
    objects['s3:b:1/big.pdf'] = makeObject('big.pdf', 21 * MB)
    objects['s3:b:1/virus.exe'] = makeObject('virus.exe', MB)

    const result = await run(['s3:b:1/big.pdf', 's3:b:1/virus.exe'])

    expect(result.totalSizeExceeded).toBe(true)
    expect(result.invalidAttachments).toEqual(['virus.exe'])
  })

  it('excludes unsupported attachments from the size total without reading them', async () => {
    objects['s3:b:1/a.pdf'] = makeObject('a.pdf', MB)
    objects['s3:b:1/big.exe'] = makeObject('big.exe', 100 * MB)

    const result = await run(['s3:b:1/a.pdf', 's3:b:1/big.exe'])

    expect(result.attachmentFiles.map((f) => f.fileName)).toEqual(['a.pdf'])
    expect(result.invalidAttachments).toEqual(['big.exe'])
    expect(objects['s3:b:1/big.exe'].read).not.toHaveBeenCalled()
  })

  it('reads nothing when another attachment fails its metadata check', async () => {
    objects['s3:b:1/a.pdf'] = makeObject('a.pdf', MB)

    await expect(run(['s3:b:1/a.pdf', 's3:b:1/missing.pdf'])).rejects.toThrow(
      'S3 metadata mismatch',
    )
    expect(objects['s3:b:1/a.pdf'].read).not.toHaveBeenCalled()
  })
})
