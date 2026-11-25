import { pipeline } from 'stream/promises'

import { AxiosError, AxiosResponse } from 'axios'

import HttpError from '@/errors/http'

import { createSizeMonitor } from './size-monitor'

export const streamResponse = async (response: AxiosResponse) => {
  if (response.data && typeof response.data.pipe === 'function') {
    const contentLength = response.headers['content-length']
    const compressedSize = contentLength ? Number(contentLength) : undefined

    // Create a size monitor stream
    const sizeMonitor = createSizeMonitor(compressedSize)
    const chunks: Buffer[] = []

    // IMPORTANT: axios `timeout` stops once headers arrive, so only the
    // request's signal can abort a stalled body.
    const signal = response.config?.signal
    try {
      await pipeline(
        response.data,
        sizeMonitor,
        async (source: AsyncIterable<Buffer>) => {
          for await (const chunk of source) {
            chunks.push(chunk)
          }
        },
        signal instanceof AbortSignal ? { signal } : {},
      )
    } catch (error) {
      throw new HttpError(error as AxiosError)
    }

    try {
      const fullData = Buffer.concat(chunks)

      // Try to parse as JSON first
      try {
        response.data = JSON.parse(fullData.toString('utf8'))
      } catch {
        response.data = fullData.toString('utf8')
      }
    } catch (error) {
      throw new HttpError(error as AxiosError)
    }
  }

  return response
}
