import { AxiosError, AxiosResponse } from 'axios'
import { PassThrough } from 'stream'

import HttpError from '@/errors/http'

import { createSizeMonitor } from './size-monitor'

export const streamResponse = async (response: AxiosResponse) => {
  if (response.data && typeof response.data.pipe === 'function') {
    const contentLength = response.headers['content-length']
    const compressedSize = contentLength
      ? parseInt(contentLength, 10)
      : undefined

    // Create a size monitor stream
    const sizeMonitor = createSizeMonitor(compressedSize)

    // Create a pass-through stream to collect the data
    const dataCollector = new PassThrough()
    const chunks: Buffer[] = []

    dataCollector.on('data', (chunk: Buffer) => {
      chunks.push(chunk)
    })

    // Wait for the stream to complete and convert to the expected format
    await new Promise((resolve, reject) => {
      // Handle errors from the size monitor
      sizeMonitor.on('error', (error) => {
        // Destroy the response stream to prevent further processing
        response.data.destroy()
        dataCollector.destroy()

        reject(new HttpError(error as AxiosError))
      })

      // Handle data collector errors
      dataCollector.on('error', (error) => {
        reject(new HttpError(error as AxiosError))
      })

      // Handle successful completion
      dataCollector.on('end', () => {
        try {
          const fullData = Buffer.concat(chunks)

          // Try to parse as JSON first
          try {
            response.data = JSON.parse(fullData.toString('utf8'))
          } catch {
            response.data = fullData.toString('utf8')
          }
          resolve(undefined)
        } catch (error) {
          reject(new HttpError(error as AxiosError))
        }
      })

      // Pipe the response through the size monitor and data collector
      response.data.pipe(sizeMonitor).pipe(dataCollector)
    })
  }

  return response
}
