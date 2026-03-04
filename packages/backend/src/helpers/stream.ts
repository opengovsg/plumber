import type { Response as ExpressResponse } from 'express'

/**
 * Pipes a web Response stream to an Express response.
 * Handles the conversion from Web Streams API to Node.js streams.
 */
export async function pipeWebResponseToExpress(
  webResponse: Response,
  expressRes: ExpressResponse,
): Promise<void> {
  // Copy headers from the web Response to Express response
  webResponse.headers.forEach((value, key) => {
    expressRes.setHeader(key, value)
  })

  // Pipe the encoded body stream to Express response
  if (webResponse.body) {
    const reader = webResponse.body.getReader()
    const pump = async (): Promise<void> => {
      const { done, value } = await reader.read()
      if (done) {
        expressRes.end()
        return
      }
      expressRes.write(Buffer.from(value))
      return pump()
    }
    await pump()
  } else {
    expressRes.end()
  }
}
