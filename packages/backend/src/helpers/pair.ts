import { createBedrockAnthropic } from '@ai-sdk/amazon-bedrock/anthropic'
import { fromNodeProviderChain } from '@aws-sdk/credential-providers'

import appConfig from '@/config/app'

const bedrock = createBedrockAnthropic({
  region: appConfig.pair.bedrock.region,
  // Picks up the ECS task role's temporary credentials; falls back to the
  // local AWS profile/SSO chain in development.
  credentialProvider: fromNodeProviderChain(),
})

const model = bedrock(appConfig.pair.bedrock.model)
const imageModel = bedrock(appConfig.pair.bedrock.imageModel)

export { imageModel, model }
