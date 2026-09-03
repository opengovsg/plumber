import { createBedrockAnthropic } from '@ai-sdk/amazon-bedrock/anthropic'

import appConfig from '@/config/app'

const bedrock = createBedrockAnthropic({
  apiKey: appConfig.pair.bedrock.apiKey,
  region: appConfig.pair.bedrock.region,
})

const model = bedrock(appConfig.pair.bedrock.model)
const imageModel = bedrock(appConfig.pair.bedrock.imageModel)

export { imageModel, model }
