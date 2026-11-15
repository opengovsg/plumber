import path from 'node:path'

import { config } from 'dotenv'

// Placeholders backstop missing keys. Local dev gets its real values from 1Password,
// which dotenv never overrides.
// IMPORTANT: without the guard, placeholders would satisfy a deployed environment's
// missing-env-var checks.
if ((process.env.APP_ENV ?? 'development') === 'development') {
  config({ path: path.resolve(__dirname, '../../../.env-example') })
}

export type AppEnvConfig = {
  appEnv: string
  isProd: boolean
  isDev: boolean
}

const appEnv = process.env.APP_ENV || 'development'

const appEnvConfig: AppEnvConfig = {
  appEnv,
  isProd: appEnv === 'prod',
  isDev: appEnv === 'development',
}

export default appEnvConfig
