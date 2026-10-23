import { LangfuseClient } from '@langfuse/client'

/**
 * Same credential path as packages/backend/src/helpers/langfuse.ts.
 * Secrets are injected by scripts/with-op-env.mjs, not read from a .env file.
 */
export function langfuseCredentials(project, env) {
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
      `Missing Langfuse credentials for project "${project}". Run this through pnpm (get-prompt, get-judge, eval-dataset) so 1Password injects them.`,
    )
  }

  return {
    baseUrl: env.PAIR_ROME_BASE_URL,
    additionalHeaders: {
      'CF-Access-Client-Id': env.PAIR_ROME_CLOUDFLARE_ZERO_TRUST_CLIENT_KEY,
      'CF-Access-Client-Secret': env.PAIR_ROME_CLOUDFLARE_ZERO_TRUST_SECRET_KEY,
    },
    ...credentials,
  }
}

export function buildLangfuseClient(project, env) {
  return new LangfuseClient({
    timeout: 30000,
    ...langfuseCredentials(project, env),
  })
}
