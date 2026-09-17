import { createBedrockAnthropic } from '@ai-sdk/amazon-bedrock/anthropic'
import { fromIni, fromNodeProviderChain } from '@aws-sdk/credential-providers'

import appConfig from '@/config/app'

const bedrock = createBedrockAnthropic({
  region: appConfig.bedrock.region,
  credentialProvider: appConfig.isDev
    ? // The default chain checks AWS_ACCESS_KEY_ID/SECRET_ACCESS_KEY first, which
      // .env-example always sets (DynamoDB Local needs *some* credentials, real or
      // not) and which would otherwise shadow the developer's real SSO session.
      // Go straight to the ini/SSO profile, bypassing that env-var check entirely.
      fromIni({ profile: appConfig.bedrock.devAwsProfile })
    : // Picks up the ECS task role's own temporary credentials.
      fromNodeProviderChain(),
})

const model = bedrock(appConfig.bedrock.model)
const imageModel = bedrock(appConfig.bedrock.imageModel)

export { imageModel, model }
