import { LangfuseClient } from '@langfuse/client'

import appConfig from '@/config/app'

// Initialise the Langfuse client
const langfuseClient = new LangfuseClient({
  timeout: 10000,
  publicKey: appConfig.pair.rome.publicKey,
  secretKey: appConfig.pair.rome.secretKey,
  baseUrl: appConfig.pair.rome.baseUrl,
  additionalHeaders: {
    'CF-Access-Client-Id': appConfig.pair.rome.cloudflare.zeroTrustClientKey,
    'CF-Access-Client-Secret':
      appConfig.pair.rome.cloudflare.zeroTrustSecretKey,
  },
})

export { langfuseClient }
