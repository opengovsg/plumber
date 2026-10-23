import { existsSync } from 'node:fs'
import path from 'node:path'

import { afterEach, describe, expect, it, vi } from 'vitest'

const { dotenvConfig, coreLoads } = vi.hoisted(() => ({
  dotenvConfig: vi.fn((_options: { path: string }) => ({})),
  coreLoads: { count: 0 },
}))

// Otherwise dotenv would refill the secrets these tests unset from .env-example.
vi.mock('dotenv', () => ({ config: dotenvConfig }))

vi.mock('@/config/app/core', async (importOriginal) => {
  coreLoads.count++
  return importOriginal()
})

// knexfile.ts runs with only DB vars, so core.ts would throw on any of these.
const CORE_ONLY_ENV_KEYS = [
  'WEB_APP_URL',
  'WEBHOOK_URL',
  'ENCRYPTION_KEY',
  'SSO_CLIENT_ID',
  'SSO_ISSUER',
  'SSO_PRIVATE_KEY_PEM',
  'PAIR_FOUNDRY_API_KEY',
  'PAIR_FOUNDRY_MODEL',
  'PAIR_FOUNDRY_IMAGE_MODEL',
] as const

afterEach(() => {
  vi.unstubAllEnvs()
  vi.resetModules()
  dotenvConfig.mockClear()
  coreLoads.count = 0
})

describe('knex-config', () => {
  it('loads without core config or its secrets', async () => {
    for (const key of CORE_ONLY_ENV_KEYS) {
      vi.stubEnv(key, undefined)
    }
    vi.stubEnv('POSTGRES_DATABASE', 'migration_target')
    vi.resetModules()

    const { config } = await import('@/config/knex-config')

    expect(coreLoads.count).toBe(0)
    expect(config.connection.database).toBe('migration_target')
  })

  it('loads .env-example from the backend package root', async () => {
    vi.stubEnv('APP_ENV', 'development')
    vi.resetModules()

    await import('@/config/knex-config')

    const envPath = dotenvConfig.mock.calls[0][0].path
    expect(envPath).toBe(path.resolve(__dirname, '../../../.env-example'))
    expect(existsSync(envPath)).toBe(true)
  })
})
