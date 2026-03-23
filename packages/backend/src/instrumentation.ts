import { LangfuseSpanProcessor } from '@langfuse/otel'
import { NodeSDK } from '@opentelemetry/sdk-node'

import appConfig from '@/config/app'

const AI_BUILDER_RESOURCE_NAMES = ['ai-chat-stream', 'generate-steps']

const PAIR_ACTION_RESOURCE_NAMES = [
  'pair-action-generate-object',
  'pair-action-process-image',
]

const BASE_CONFIG = {
  baseUrl: appConfig.pair.rome.baseUrl,
  additionalHeaders: {
    'CF-Access-Client-Id': appConfig.pair.rome.cloudflare.zeroTrustClientKey,
    'CF-Access-Client-Secret':
      appConfig.pair.rome.cloudflare.zeroTrustSecretKey,
  },
  environment: appConfig.appEnv,
}

const aiBuilderSpanProcessor = new LangfuseSpanProcessor({
  ...BASE_CONFIG,
  publicKey: appConfig.pair.rome.aiBuilder.publicKey,
  secretKey: appConfig.pair.rome.aiBuilder.secretKey,
  shouldExportSpan: (span) => {
    const resourceName = span.otelSpan.attributes['resource.name'] as string

    // Include spans with matching resource names
    if (AI_BUILDER_RESOURCE_NAMES.includes(resourceName)) {
      return true
    }

    // Include spans without resource.name (likely parent/wrapper spans)
    if (!resourceName) {
      return true
    }

    // Exclude pair-action spans
    if (PAIR_ACTION_RESOURCE_NAMES.includes(resourceName)) {
      return false
    }

    // Include everything else (other instrumentation, middleware, etc.)
    return true
  },
})

const pairActionSpanProcessor = new LangfuseSpanProcessor({
  ...BASE_CONFIG,
  publicKey: appConfig.pair.rome.pairAction.publicKey,
  secretKey: appConfig.pair.rome.pairAction.secretKey,
  shouldExportSpan: (span) => {
    // NOTE: we don't need to include spans without resource.name as we are not manually
    // creating spans for Pair actions
    return PAIR_ACTION_RESOURCE_NAMES.includes(
      span.otelSpan.attributes['resource.name'] as string,
    )
  },
})

const sdk = new NodeSDK({
  spanProcessors: [aiBuilderSpanProcessor, pairActionSpanProcessor],
})

sdk.start()
