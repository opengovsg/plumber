import { LangfuseSpanProcessor } from '@langfuse/otel'
import { NodeSDK } from '@opentelemetry/sdk-node'

import appConfig from '@/config/app'

const { publicKey, secretKey, baseUrl } = appConfig.pair.rome
const { zeroTrustClientKey, zeroTrustSecretKey } =
  appConfig.pair.rome.cloudflare

const isConfigured =
  publicKey &&
  secretKey &&
  baseUrl &&
  zeroTrustClientKey &&
  zeroTrustSecretKey &&
  ![publicKey, secretKey, baseUrl, zeroTrustClientKey, zeroTrustSecretKey].some(
    (v) => v === '...',
  )

if (isConfigured) {
  const langfuseSpanProcessor = new LangfuseSpanProcessor({
    publicKey,
    secretKey,
    baseUrl,
    additionalHeaders: {
      'CF-Access-Client-Id': zeroTrustClientKey,
      'CF-Access-Client-Secret': zeroTrustSecretKey,
    },
    environment: appConfig.appEnv,
  })

  const sdk = new NodeSDK({
    spanProcessors: [langfuseSpanProcessor],
  })

  sdk.start()
}
