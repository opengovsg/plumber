import path from 'node:path'

import { config } from 'dotenv'

// Placeholders backstop missing keys. Local dev gets its real values from 1Password,
// which dotenv never overrides.
// IMPORTANT: without the guard, placeholders would satisfy a deployed environment's
// missing-env-var checks.
if ((process.env.APP_ENV ?? 'development') === 'development') {
  config({ path: path.resolve(__dirname, '../../../.env-example') })
}
