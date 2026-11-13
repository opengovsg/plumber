import { LangfuseClient } from '@langfuse/client'

export const PROJECTS = ['aiBuilder', 'pairAction']

export function buildLangfuseClient(project, env, { timeout = 10000 } = {}) {
  const credentials =
    project === 'aiBuilder'
      ? {
          publicKey: env.PAIR_ROME_AI_BUILDER_PUBLIC_KEY,
          secretKey: env.PAIR_ROME_AI_BUILDER_SECRET_KEY,
        }
      : {
          publicKey: env.PAIR_ROME_PAIR_ACTION_PUBLIC_KEY,
          secretKey: env.PAIR_ROME_PAIR_ACTION_SECRET_KEY,
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
