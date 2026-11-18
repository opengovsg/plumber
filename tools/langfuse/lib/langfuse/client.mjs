import { LangfuseClient } from '@langfuse/client'

import { PROJECT_CREDENTIAL_ENV } from '../constants.mjs'

const DEFAULT_TIMEOUT_MS = 10_000

export function buildLangfuseClient(
  project,
  env,
  { timeout = DEFAULT_TIMEOUT_MS } = {},
) {
  const credentialEnv = PROJECT_CREDENTIAL_ENV[project]
  if (!credentialEnv) {
    throw new Error(`Unknown Langfuse project "${project}".`)
  }
  const credentials = {
    publicKey: env[credentialEnv.publicKey],
    secretKey: env[credentialEnv.secretKey],
  }

  if (!credentials.publicKey || !credentials.secretKey) {
    throw new Error(
      `Missing Langfuse credentials for project "${project}". Run this through its "pnpm run" script so 1Password injects them.`,
    )
  }

  return new LangfuseClient({
    timeout,
    baseUrl: env.PAIR_ROME_BASE_URL,
    additionalHeaders: {
      'CF-Access-Client-Id': env.PAIR_ROME_CLOUDFLARE_ZERO_TRUST_CLIENT_KEY,
      'CF-Access-Client-Secret': env.PAIR_ROME_CLOUDFLARE_ZERO_TRUST_SECRET_KEY,
    },
    ...credentials,
  })
}
