import http from 'http'
import { AddressInfo } from 'net'
import { Readable } from 'stream'

import axios, { AxiosResponse } from 'axios'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import addInterceptors from '@/apps/custom-api/common/add-interceptors'
import { streamResponse } from '@/apps/custom-api/common/stream-response'
import HttpError from '@/errors/http'

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
    vi.clearAllMocks()
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

  describe('stalled or broken bodies', () => {
    it('rejects when the response stream errors mid-body', async () => {
      const stream = new Readable({
        read() {
          this.push('partial')
          this.destroy(new Error('socket hang up'))
        },
      })
      const response = createMockResponse(stream)

      await expect(streamResponse(response)).rejects.toThrow(HttpError)
    })

    it('rejects and destroys a stalled body when the request signal aborts', async () => {
      const stream = new Readable({ read() {} })
      const deadline = new AbortController()
      const response = createMockResponse(stream)
      response.config = { signal: deadline.signal } as any

      const result = streamResponse(response)
      deadline.abort()

      await expect(result).rejects.toThrow(HttpError)
      expect(stream.destroyed).toBe(true)
    })

    it('aborts a real body that stalls after headers', async () => {
      const server = http.createServer((_req, res) => {
        res.writeHead(200, { 'content-type': 'application/json' })
        res.write('{"partial":')
      })
      await new Promise<void>((resolve) =>
        server.listen(0, '127.0.0.1', resolve),
      )
      const { port } = server.address() as AddressInfo
      const client = axios.create()
      addInterceptors(client)
      const deadline = new AbortController()
      const timer = setTimeout(() => deadline.abort(), 100)

      try {
        await expect(
          client.request({
            url: `http://127.0.0.1:${port}`,
            responseType: 'stream',
            timeout: 100,
            signal: deadline.signal,
          }),
        ).rejects.toThrow(HttpError)
      } finally {
        clearTimeout(timer)
        server.closeAllConnections()
        await new Promise((resolve) => server.close(resolve))
      }
    })
  })

  describe('non-2xx body that errors mid-stream', () => {
    it('rejects with a serialisable HttpError', async () => {
      const server = http.createServer((_req, res) => {
        res.writeHead(502, { 'content-length': '100' })
        res.write('partial')
        setTimeout(() => res.socket?.destroy(), 20)
      })
      await new Promise<void>((resolve) =>
        server.listen(0, '127.0.0.1', resolve),
      )
      const { port } = server.address() as AddressInfo
      const client = axios.create()
      addInterceptors(client)

      try {
        const error = await client
          .request({ url: `http://127.0.0.1:${port}`, responseType: 'stream' })
          .catch((e: unknown) => e)

        expect(error).toBeInstanceOf(HttpError)
        expect(() => JSON.stringify(error)).not.toThrow()
      } finally {
        server.closeAllConnections()
        await new Promise((resolve) => server.close(resolve))
      }
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
