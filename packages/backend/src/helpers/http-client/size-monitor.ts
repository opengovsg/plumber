import { Transform } from 'stream'

import logger from '../logger'

const MAX_SIZE_IN_MB = 20
const MB = 1024 * 1024
const MAX_CONTENT_LENGTH = MAX_SIZE_IN_MB * MB // 20MB
const MAX_COMPRESSION_RATIO = 100 // Maximum compression ratio to prevent gzip bombs

const ERROR_RESPONSE = {
  status: 413,
  statusText: 'Payload Too Large',
  data: { error: 'Response body too large' },
}

// Create a streaming size monitor that throws if response is too large
export const createSizeMonitor = (compressedSize?: number) => {
  let totalSize = 0
  let hasThrown = false

  return new Transform({
    transform(chunk: Buffer, encoding, callback) {
      try {
        if (hasThrown) {
          return callback()
        }

        totalSize += chunk.length

        // Check if we've exceeded the maximum size
        if (totalSize > MAX_CONTENT_LENGTH) {
          hasThrown = true
          const error = new Error(
            `Response body size exceeds maximum allowed size (${MAX_SIZE_IN_MB}MB)`,
          ) as any
          error.response = ERROR_RESPONSE
          error.isAxiosError = true
          error.toJSON = () => ({})
          error.name = 'AxiosError'
          return callback(error)
        }

        // Check compression ratio if we have compressed size
        if (compressedSize && compressedSize > 0) {
          const compressionRatio = totalSize / compressedSize
          if (compressionRatio > MAX_COMPRESSION_RATIO) {
            hasThrown = true
            logger.error(
              `Response compression ratio (${compressionRatio.toFixed(
                1,
              )}:1) exceeds maximum allowed ratio (${MAX_COMPRESSION_RATIO}:1). Possible gzip bomb detected.`,
            )
            const error = new Error(
              `Response compression ratio (${compressionRatio.toFixed(
                1,
              )}:1) exceeds maximum allowed ratio (${MAX_COMPRESSION_RATIO}:1). Possible gzip bomb detected.`,
            ) as any
            error.response = ERROR_RESPONSE
            error.isAxiosError = true
            error.toJSON = () => ({})
            error.name = 'AxiosError'
            return callback(error)
          }
        }

        callback(null, chunk)
      } catch (error) {
        callback(error)
      }
    },
    flush(callback) {
      // Ensure the stream completes properly
      callback()
    },
  })
}
