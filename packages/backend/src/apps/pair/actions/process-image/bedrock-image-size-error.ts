import { APICallError } from 'ai'
import z from 'zod'

// Anthropic error bodies on Bedrock carry the message here. Other shapes fall back to `error.message`.
const errorDataSchema = z.object({
  error: z.object({
    message: z.string(),
  }),
})

/**
 * Matches Bedrock's validation message for images over its hard size limit.
 *
 * e.g. "image exceeds 5 MB maximum: 5899164 bytes > 5242880 bytes"
 */
const IMAGE_TOO_LARGE_MESSAGE_PATTERN =
  /image exceeds \d+(?:\.\d+)?\s*MB maximum/i

/**
 * Returns true if `error` is Bedrock's "image too large" validation error.
 */
export function isBedrockImageTooLargeError(error: unknown): boolean {
  if (!APICallError.isInstance(error)) {
    return false
  }

  const parsedData = errorDataSchema.safeParse(error.data)
  const message = parsedData.success
    ? parsedData.data.error.message
    : error.message

  return IMAGE_TOO_LARGE_MESSAGE_PATTERN.test(message)
}
