import { APICallError } from 'ai'
import { z } from 'zod/v4'

import { BadUserInputError } from '@/errors/graphql-errors'
import { UserFacingError } from '@/errors/user-facing-error'

/**
 * Shown whenever the AI Builder chat stream fails for a reason we cannot map
 * to a specific, actionable message. Prefer this over forwarding provider
 * errors (LiteLLM / Bedrock / OpenAI-compatible gateways dump long, noisy
 * strings that are useless to end users).
 *
 * Matches the dynamic-data route pattern: UserFacingError → message as-is;
 * everything else → a safe generic string.
 */
export const AI_CHAT_GENERIC_ERROR_MESSAGE =
  'Something went wrong generating a response. Please try again.'

/**
 * Returned for AbortError so the frontend can skip the error toast when the
 * user cancels a stream. Empty string is intentional — useChat surfaces
 * whatever onError returns as error.message.
 */
export const AI_CHAT_ABORTED_ERROR_MESSAGE = ''

/**
 * We call models through a litellm gateway using an OpenAI-compatible client
 * (see `@/helpers/pair`). On failure, the AI SDK parses the gateway's JSON
 * error body into this shape (see `@ai-sdk/openai`'s `openaiErrorDataSchema`)
 * and exposes it as `APICallError.data`.
 */
const liteLlmErrorDataSchema = z.object({
  error: z.object({
    message: z.string(),
  }),
})

function isAbortError(error: unknown): boolean {
  if (error == null || typeof error !== 'object') {
    return false
  }
  // Prefer the DOM/Node AbortError name. Avoid substring matching on message —
  // litellm fallback dumps sometimes mention "aborted" mid-string.
  if ('name' in error && error.name === 'AbortError') {
    return true
  }
  return (
    error instanceof Error && error.message === 'This operation was aborted'
  )
}

/**
 * Detects litellm / gateway dumps that should never reach the UI. litellm is
 * configured with model fallbacks, so failure messages are often long strings
 * with repeated fallback-attempt details.
 */
function looksLikeProviderNoise(message: string): boolean {
  return /litellm|openai\.|bedrock|anthropic|rate.?limit|context.?length|token.?limit|APICallError|Error code:\s*\d+/i.test(
    message,
  )
}

function extractProviderMessage(error: APICallError): string {
  const parsedData = liteLlmErrorDataSchema.safeParse(error.data)
  if (parsedData.success) {
    return parsedData.data.error.message
  }
  return error.message
}

function mapStatusToMessage(statusCode: number | undefined): string | null {
  if (statusCode === 429) {
    return 'The AI service is temporarily busy. Please try again in a moment.'
  }
  if (statusCode === 408 || statusCode === 504) {
    return 'The AI service took too long to respond. Please try again.'
  }
  if (statusCode === 413) {
    return 'Your conversation is too long for the AI to process. Please start a new chat.'
  }
  if (statusCode !== undefined && statusCode >= 500) {
    return 'The AI service is temporarily unavailable. Please try again.'
  }
  return null
}

function mapProviderMessage(message: string): string {
  if (/rate.?limit|429/i.test(message)) {
    return 'The AI service is temporarily busy. Please try again in a moment.'
  }
  if (/timeout|timed?\s*out|504|408/i.test(message)) {
    return 'The AI service took too long to respond. Please try again.'
  }
  if (
    /context.?length|token.?limit|too many tokens|maximum context/i.test(
      message,
    )
  ) {
    return 'Your conversation is too long for the AI to process. Please start a new chat.'
  }
  return AI_CHAT_GENERIC_ERROR_MESSAGE
}

function mapApiCallError(error: APICallError): string {
  const fromStatus = mapStatusToMessage(error.statusCode)
  if (fromStatus) {
    return fromStatus
  }
  return mapProviderMessage(extractProviderMessage(error))
}

/**
 * Maps chat-stream errors to a short, user-safe string for the AI SDK's
 * `onError` callbacks (`createUIMessageStream` / `toUIMessageStream`) and the
 * Express 500 fallback.
 *
 * - `UserFacingError` / `BadUserInputError` → message preserved (MCP tools and
 *   workflow parsing already throw these for actionable cases)
 * - Abort → empty string (frontend skips toast)
 * - `APICallError` / litellm noise → mapped or generic
 * - Anything else → generic (never forward raw provider / stack text)
 */
export function getAiChatErrorMessage(error: unknown): string {
  if (error == null) {
    return AI_CHAT_GENERIC_ERROR_MESSAGE
  }

  if (isAbortError(error)) {
    return AI_CHAT_ABORTED_ERROR_MESSAGE
  }

  if (error instanceof UserFacingError || error instanceof BadUserInputError) {
    return error.message
  }

  if (APICallError.isInstance(error)) {
    return mapApiCallError(error)
  }

  if (typeof error === 'string') {
    return looksLikeProviderNoise(error)
      ? mapProviderMessage(error)
      : AI_CHAT_GENERIC_ERROR_MESSAGE
  }

  if (error instanceof Error) {
    if (looksLikeProviderNoise(error.message)) {
      return mapProviderMessage(error.message)
    }
    return AI_CHAT_GENERIC_ERROR_MESSAGE
  }

  return AI_CHAT_GENERIC_ERROR_MESSAGE
}
