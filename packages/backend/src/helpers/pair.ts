import { createBedrockAnthropic } from '@ai-sdk/amazon-bedrock/anthropic'
import type { LanguageModelV2 } from '@ai-sdk/provider'
import { fromNodeProviderChain } from '@aws-sdk/credential-providers'

import appConfig from '@/config/app'

const bedrock = createBedrockAnthropic({
  region: appConfig.pair.bedrock.region,
  // Picks up the ECS task role's temporary credentials; falls back to the
  // local AWS profile/SSO chain in development.
  credentialProvider: fromNodeProviderChain(),
})

const model: LanguageModelV2 = bedrock(appConfig.pair.bedrock.model)
const imageModel: LanguageModelV2 = bedrock(appConfig.pair.bedrock.imageModel)

export { imageModel, model }
