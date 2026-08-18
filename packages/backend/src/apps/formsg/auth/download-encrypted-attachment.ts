import axios from 'axios'

import logger from '@/helpers/logger'

const MAX_ATTEMPTS = 3
const BASE_BACKOFF_MS = 200
const PER_ATTEMPT_TIMEOUT_MS = 2000

/**
 * Wall-clock budget for one download, retries included. Attachments download
 * concurrently, so this bounds the whole download phase too.
 *
 * Half of FormSG's 10s webhook timeout. Overshooting is worse than surfacing
 * the 503: FormSG re-delivers either way, but a timeout says nothing about why.
 */
const BUDGET_MS = 5000

/**
 * The AWS SDK's default retry policy: 429 for throttling, plus the statuses it
 * treats as transient. Anything else is a real failure that retrying will not
 * fix.
 */
const RETRYABLE_STATUSES = new Set([429, 500, 502, 503, 504])

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

interface EncryptedAttachmentPayload {
  encryptedFile: {
    submissionPublicKey: string
    nonce: string
    binary: string
  }
}

/**
 * Rebuilds the failure as a plain Error carrying only a description of it.
 *
 * Callers log whatever we throw. An axios error would drag the presigned URL,
 * the request headers and the response body along with it, so none of the
 * original is kept, not even as a cause.
 */
function sanitiseError(error: unknown): Error {
  if (axios.isAxiosError(error)) {
    const status = error.response?.status
    const outcome = status ? `status ${status}` : 'no response'

    return new Error(
      `Attachment download failed with ${outcome}: ${error.message}`,
    )
  }

  if (error instanceof Error) {
    return new Error(
      `Attachment download failed with ${error.constructor.name}: ${error.message}`,
    )
  }

  return new Error(`Attachment download failed with a thrown ${typeof error}`)
}

/**
 * Downloads one encrypted attachment from a FormSG presigned S3 URL, with
 * retries as needed.
 */
export async function downloadEncryptedAttachment(
  url: string,
): Promise<EncryptedAttachmentPayload> {
  const deadline = Date.now() + BUDGET_MS

  for (let attempt = 1; ; attempt += 1) {
    const timeout = Math.min(
      PER_ATTEMPT_TIMEOUT_MS,
      Math.max(1, deadline - Date.now()),
    )

    try {
      const { data } = await axios.get<EncryptedAttachmentPayload>(url, {
        responseType: 'json',
        timeout,
      })
      return data
    } catch (error) {
      const status = axios.isAxiosError(error)
        ? error.response?.status
        : undefined
      const isRetryable = status != null && RETRYABLE_STATUSES.has(status)

      if (attempt >= MAX_ATTEMPTS || !isRetryable) {
        throw sanitiseError(error)
      }

      // Full jitter, so concurrent attachments don't retry in lockstep.
      const backoffMs = Math.random() * BASE_BACKOFF_MS * 2 ** (attempt - 1)

      // Never start a retry past the deadline.
      if (Date.now() + backoffMs >= deadline) {
        throw sanitiseError(error)
      }

      logger.warn({
        event: 'formsg-attachment-download-retry',
        attempt,
        status,
        backoffMs,
      })

      await sleep(backoffMs)
    }
  }
}
