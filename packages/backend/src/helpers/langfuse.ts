import { LangfuseClient } from '@langfuse/client'

import appConfig from '@/config/app'

export type LangfuseProject = 'aiBuilder' | 'pairAction'

// Base configuration shared by all clients
const BASE_CONFIG = {
  timeout: 10000,
  baseUrl: appConfig.pair.rome.baseUrl,
  additionalHeaders: {
    'CF-Access-Client-Id': appConfig.pair.rome.cloudflare.zeroTrustClientKey,
    'CF-Access-Client-Secret':
      appConfig.pair.rome.cloudflare.zeroTrustSecretKey,
  },
}

// Lazy-initialized clients map
const clients = new Map<LangfuseProject, LangfuseClient>()

/**
 * Get or create a Langfuse client for the specified project
 */
export function getLangfuseClient(project: LangfuseProject): LangfuseClient {
  const existing = clients.get(project)
  if (existing) {
    return existing
  }

  const credentials =
    project === 'aiBuilder'
      ? appConfig.pair.rome.aiBuilder
      : appConfig.pair.rome.pairAction

  const client = new LangfuseClient({
    ...BASE_CONFIG,
    publicKey: credentials.publicKey,
    secretKey: credentials.secretKey,
  })

  clients.set(project, client)
  return client
}
