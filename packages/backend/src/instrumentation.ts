import { LangfuseSpanProcessor } from '@langfuse/otel'
import { NodeSDK } from '@opentelemetry/sdk-node'

import appConfig from '@/config/app'

const langfuseSpanProcessor = new LangfuseSpanProcessor({
  publicKey: appConfig.pair.rome.publicKey,
  secretKey: appConfig.pair.rome.secretKey,
  baseUrl: appConfig.pair.rome.baseUrl,
  additionalHeaders: {
    'CF-Access-Client-Id': appConfig.pair.rome.cloudflare.zeroTrustClientKey,
    'CF-Access-Client-Secret':
      appConfig.pair.rome.cloudflare.zeroTrustSecretKey,
  },
  environment: appConfig.appEnv,
})

const sdk = new NodeSDK({
  spanProcessors: [langfuseSpanProcessor],
})

sdk.start()
