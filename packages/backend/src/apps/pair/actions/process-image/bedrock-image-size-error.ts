import { APICallError } from 'ai'
import z from 'zod'

/**
 * We call Bedrock models through a litellm gateway using an OpenAI-compatible
 * client (see `@/helpers/pair`). On failure, the AI SDK parses the gateway's
 * JSON error body into this shape (see `@ai-sdk/openai`'s
 * `openaiErrorDataSchema`) and exposes it as `APICallError.data`.
 */
const liteLlmErrorDataSchema = z.object({
  error: z.object({
    message: z.string(),
  }),
})

/**
 * Bedrock rejects images over its hard size limit with a validation message
 * like:
 *
 *   "image exceeds 5 MB maximum: 5899164 bytes > 5242880 bytes"
 *
 * litellm is also configured with model fallbacks, so on failure the error
 * message ends up being a long, noisy string with repeated fallback-attempt
 * details tacked on. We only need to detect whether the message contains
 * this specific validation error, so we search rather than parse the whole
 * string structurally.
 */
const IMAGE_TOO_LARGE_MESSAGE_PATTERN =
  /image exceeds \d+(?:\.\d+)?\s*MB maximum/i

/**
 * Returns true if `error` is Bedrock's "image too large" validation error,
 * surfaced through our litellm gateway.
 */
export function isBedrockImageTooLargeError(error: unknown): boolean {
  if (!APICallError.isInstance(error)) {
    return false
  }

  const parsedData = liteLlmErrorDataSchema.safeParse(error.data)
  const message = parsedData.success
    ? parsedData.data.error.message
    : error.message

  return IMAGE_TOO_LARGE_MESSAGE_PATTERN.test(message)
}
