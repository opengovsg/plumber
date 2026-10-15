import { createBedrockAnthropic } from '@ai-sdk/amazon-bedrock/anthropic'
import type { LanguageModelV2 } from '@ai-sdk/provider'
import { fromNodeProviderChain } from '@aws-sdk/credential-providers'
import { wrapLanguageModel } from 'ai'

import appConfig from '@/config/app'

import { fallbackMiddleware } from './bedrock-fallback'

const bedrock = createBedrockAnthropic(
  appConfig.isDev
    ? {
        region: appConfig.bedrock.region,
        apiKey: appConfig.bedrock.devApiKey,
      }
    : {
        region: appConfig.bedrock.region,
        // IMPORTANT: an empty string stops the provider falling back to
        // AWS_BEARER_TOKEN_BEDROCK, so deployed envs always sign with the task role.
        apiKey: '',
        credentialProvider: fromNodeProviderChain(),
      },
)

const fallbackModel = bedrock(appConfig.bedrock.fallbackModel)

function withFallback(modelId: string): LanguageModelV2 {
  return wrapLanguageModel({
    model: bedrock(modelId),
    middleware: fallbackMiddleware(fallbackModel),
  })
}

const model = withFallback(appConfig.bedrock.model)
const imageModel = withFallback(appConfig.bedrock.imageModel)

// IMPORTANT: the SDK's default JSON tool forces tool_choice, which Claude Sonnet 5.5 rejects with a 400.
const structuredOutputProviderOptions = {
  anthropic: { structuredOutputMode: 'outputFormat' as const },
}

export { imageModel, model, structuredOutputProviderOptions }
