import type { LanguageModelV2 } from '@ai-sdk/provider'
import { APICallError, type LanguageModelMiddleware } from 'ai'

import logger from '@/helpers/logger'

function isRetryableApiError(error: unknown): error is APICallError {
  return APICallError.isInstance(error) && error.isRetryable
}

/**
 * Retries a failed Bedrock call once on a fallback model.
 *
 * PAIR's gateway used to do this for us. Bedrock has no server-side model fallback.
 */
export function fallbackMiddleware(
  fallbackModel: LanguageModelV2,
): LanguageModelMiddleware {
  return {
    middlewareVersion: 'v2',
    wrapGenerate: async ({ doGenerate, params, model }) => {
      try {
        const result = await doGenerate()
        if (result.finishReason !== 'content-filter') {
          return result
        }
        logger.warn('Bedrock model refused, retrying on fallback model', {
          model: model.modelId,
          fallbackModel: fallbackModel.modelId,
        })
      } catch (error) {
        if (!isRetryableApiError(error)) {
          throw error
        }
        // IMPORTANT: log only the status code. The error carries the prompt in its request body.
        logger.warn('Bedrock model failed, retrying on fallback model', {
          model: model.modelId,
          fallbackModel: fallbackModel.modelId,
          statusCode: error.statusCode,
        })
      }
      return fallbackModel.doGenerate(params)
    },
    // Only connection-time failures fall back. Switching models mid-stream would garble the reply.
    wrapStream: async ({ doStream, params, model }) => {
      try {
        return await doStream()
      } catch (error) {
        if (!isRetryableApiError(error)) {
          throw error
        }
        logger.warn('Bedrock model failed, retrying on fallback model', {
          model: model.modelId,
          fallbackModel: fallbackModel.modelId,
          statusCode: error.statusCode,
        })
        return fallbackModel.doStream(params)
      }
    },
  }
}
