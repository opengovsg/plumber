import { Readable, Transform, Writable } from 'stream'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { createSizeMonitor } from '@/apps/custom-api/common/size-monitor'

const mocks = vi.hoisted(() => ({
  warn: vi.fn(),
}))

vi.mock('@/helpers/logger', () => ({
  default: {
    warn: mocks.warn,
  },
}))

// Helper to stream buffers through a Transform and collect output
const writeBuffers = (monitor: Transform, buffers: Buffer[]) =>
  new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = []

    const source = Readable.from(buffers)
    const sink = new Writable({
      write(chunk, _enc, cb) {
        chunks.push(Buffer.from(chunk))
        cb()
      },
    })

    source.on('error', reject)
    monitor.on('error', reject)
    sink.on('error', reject)
    sink.on('finish', () => resolve(Buffer.concat(chunks)))

    source.pipe(monitor).pipe(sink)
  })

describe('createSizeMonitor', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('passes through data under the maximum size', async () => {
    const monitor = createSizeMonitor()
    const input = [Buffer.alloc(1024), Buffer.from('hello')]
    const output = await writeBuffers(monitor, input)
    expect(output.length).toBe(input[0].length + input[1].length)
    expect(mocks.warn).not.toHaveBeenCalled()
  })

  it('errors when total size exceeds 2 MB', async () => {
    const monitor = createSizeMonitor()
    const overLimit = Buffer.alloc(2 * 1024 * 1024 + 1)
    await expect(writeBuffers(monitor, [overLimit])).rejects.toMatchObject({
      name: 'AxiosError',
      isAxiosError: true,
      response: {
        status: 413,
        statusText: 'Payload Too Large',
        data: { error: 'Response body too large' },
      },
    })
  })

  it('errors when compression ratio exceeds the limit and warns', async () => {
    const monitor = createSizeMonitor(1) // compressed size 1 byte
    await expect(
      writeBuffers(monitor, [Buffer.alloc(200)]),
    ).rejects.toMatchObject({
      name: 'AxiosError',
      isAxiosError: true,
      response: expect.objectContaining({ status: 413 }),
    })
    expect(mocks.warn).toHaveBeenCalled()
  })
})
