import { AxiosResponse } from 'axios'
import { Readable } from 'stream'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import HttpError from '@/errors/http'
import { streamResponse } from '@/helpers/http-client/stream-response'

const mocks = vi.hoisted(() => ({
  warn: vi.fn(),
}))

vi.mock('@/helpers/logger', () => ({
  default: {
    warn: mocks.warn,
  },
}))

const createMockResponse = (
  data: any,
  headers: Record<string, string> = {},
): AxiosResponse => ({
  data,
  status: 200,
  statusText: 'OK',
  headers: headers,
  config: {} as any,
})

const createStreamFromData = (data: string | Buffer): Readable => {
  const stream = new Readable()
  stream.push(data)
  stream.push(null) // End the stream
  return stream
}

describe('streamResponse', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('non-stream responses', () => {
    it('passes through non-stream data unchanged', async () => {
      const originalData = { message: 'Hello World' }
      const response = createMockResponse(originalData)

      const result = await streamResponse(response)

      expect(result).toBe(response)
      expect(result.data).toBe(originalData)
    })

    it('passes through string data unchanged', async () => {
      const originalData = 'Hello World'
      const response = createMockResponse(originalData)

      const result = await streamResponse(response)

      expect(result).toBe(response)
      expect(result.data).toBe(originalData)
    })

    it('passes through null data unchanged', async () => {
      const response = createMockResponse(null)

      const result = await streamResponse(response)

      expect(result).toBe(response)
      expect(result.data).toBeNull()
    })
  })

  describe('stream responses', () => {
    it('processes JSON stream data correctly', async () => {
      const jsonData = { message: 'Hello World', count: 42 }
      const jsonString = JSON.stringify(jsonData)
      const stream = createStreamFromData(jsonString)
      const response = createMockResponse(stream, { 'content-length': '50' })

      const result = await streamResponse(response)

      expect(result).toBe(response)
      expect(result.data).toEqual(jsonData)
    })

    it('processes text stream data correctly', async () => {
      const textData = 'Hello World'
      const stream = createStreamFromData(textData)
      const response = createMockResponse(stream)

      const result = await streamResponse(response)

      expect(result).toBe(response)
      expect(result.data).toBe(textData)
    })

    it('handles empty stream data', async () => {
      const stream = createStreamFromData('')
      const response = createMockResponse(stream)

      const result = await streamResponse(response)

      expect(result).toBe(response)
      expect(result.data).toBe('')
    })

    it('handles binary data as text', async () => {
      const binaryData = Buffer.from([0x48, 0x65, 0x6c, 0x6c, 0x6f]) // "Hello"
      const stream = createStreamFromData(binaryData)
      const response = createMockResponse(stream)

      const result = await streamResponse(response)

      expect(result).toBe(response)
      expect(result.data).toBe('Hello')
    })
  })

  describe('size monitoring', () => {
    it('rejects when response exceeds 20MB limit', async () => {
      const largeData = Buffer.alloc(20 * 1024 * 1024 + 1) // 20MB + 1 byte
      const stream = createStreamFromData(largeData)
      const response = createMockResponse(stream)

      await expect(streamResponse(response)).rejects.toThrow(HttpError)
    })

    it('rejects when compression ratio exceeds limit', async () => {
      const largeData = Buffer.alloc(200) // 200 bytes
      const stream = createStreamFromData(largeData)
      const response = createMockResponse(stream, { 'content-length': '1' }) // 1 byte compressed

      await expect(streamResponse(response)).rejects.toThrow(HttpError)
      expect(mocks.warn).toHaveBeenCalled()
    })

    it('handles content-length header parsing', async () => {
      const jsonData = { message: 'test' }
      const jsonString = JSON.stringify(jsonData)
      const stream = createStreamFromData(jsonString)
      const response = createMockResponse(stream, { 'content-length': '20' })

      const result = await streamResponse(response)

      expect(result.data).toEqual(jsonData)
    })

    it('handles invalid content-length header gracefully', async () => {
      const jsonData = { message: 'test' }
      const jsonString = JSON.stringify(jsonData)
      const stream = createStreamFromData(jsonString)
      const response = createMockResponse(stream, {
        'content-length': 'invalid',
      })

      const result = await streamResponse(response)

      expect(result.data).toEqual(jsonData)
    })
  })

  describe('error handling', () => {
    it('handles size monitor errors', async () => {
      const largeData = Buffer.alloc(20 * 1024 * 1024 + 1)
      const stream = createStreamFromData(largeData)
      const response = createMockResponse(stream)

      // Mock destroy method to verify it's called
      const destroySpy = vi.spyOn(stream, 'destroy')

      await expect(streamResponse(response)).rejects.toThrow(HttpError)
      expect(destroySpy).toHaveBeenCalled()
    })

    it('handles JSON parsing errors gracefully', async () => {
      const invalidJson = '{ invalid json }'
      const stream = createStreamFromData(invalidJson)
      const response = createMockResponse(stream)

      const result = await streamResponse(response)

      expect(result.data).toBe(invalidJson)
    })

    it('handles buffer concatenation errors', async () => {
      const stream = createStreamFromData('test')
      const response = createMockResponse(stream)

      // Mock Buffer.concat to throw an error
      const originalConcat = Buffer.concat
      vi.spyOn(Buffer, 'concat').mockImplementation(() => {
        throw new Error('Buffer concatenation error')
      })

      await expect(streamResponse(response)).rejects.toThrow(HttpError)

      // Restore original method
      Buffer.concat = originalConcat
    })
  })

  describe('stream cleanup', () => {
    it('destroys response stream on size monitor error', async () => {
      const largeData = Buffer.alloc(20 * 1024 * 1024 + 1)
      const stream = createStreamFromData(largeData)
      const response = createMockResponse(stream)

      const destroySpy = vi.spyOn(stream, 'destroy')

      await expect(streamResponse(response)).rejects.toThrow(HttpError)
      expect(destroySpy).toHaveBeenCalled()
    })
  })
})
