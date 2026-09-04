import { afterEach, describe, expect, it, vi } from 'vitest'

import type { AppConfig } from '@/config/app.js'

// Each test re-imports app.ts, which would otherwise re-run dotenv and restore
// the real .env values on top of the stubbed ones.
vi.mock('dotenv/config', () => ({}))

const SES_ENV_KEYS = [
  'SES_FROM_ADDRESS',
  'SES_REGION',
  'SES_ACCESS_KEY_ID',
  'SES_SECRET_ACCESS_KEY',
] as const

type SesEnv = Partial<Record<(typeof SES_ENV_KEYS)[number], string>>

async function loadSesConfig(env: SesEnv) {
  for (const key of SES_ENV_KEYS) {
    vi.stubEnv(key, env[key])
  }
  vi.resetModules()
  const { default: appConfig } =
    (await import('@/config/app.js')) as unknown as {
      default: AppConfig
    }
  return appConfig.ses
}

afterEach(() => {
  vi.unstubAllEnvs()
  vi.resetModules()
})

describe('appConfig.ses', () => {
  describe('from address and region', () => {
    it('reads both from the environment', async () => {
      const ses = await loadSesConfig({
        SES_FROM_ADDRESS: 'noreply@agency.gov.sg',
        SES_REGION: 'ap-southeast-1',
      })

      expect(ses.fromAddress).toBe('noreply@agency.gov.sg')
      expect(ses.region).toBe('ap-southeast-1')
    })

    it('does not fall back to a hardcoded address or region', async () => {
      const ses = await loadSesConfig({})

      expect(ses.fromAddress).toBeUndefined()
      expect(ses.region).toBeUndefined()
    })
  })

  describe('explicit credentials', () => {
    it('sets credentials when both the access key and the secret are given', async () => {
      const ses = await loadSesConfig({
        SES_ACCESS_KEY_ID: 'AKIAVAPT',
        SES_SECRET_ACCESS_KEY: 'vapt-secret',
      })

      expect(ses.credentials).toEqual({
        accessKeyId: 'AKIAVAPT',
        secretAccessKey: 'vapt-secret',
      })
    })

    // Leaving credentials unset is what makes the SDK fall back to the default
    // provider chain (SSO/task role), so a half-configured pair must not
    // produce a partial credentials object.
    it('leaves credentials unset when neither is given', async () => {
      const ses = await loadSesConfig({})

      expect(ses.credentials).toBeUndefined()
    })

    it('leaves credentials unset when only the access key is given', async () => {
      const ses = await loadSesConfig({ SES_ACCESS_KEY_ID: 'AKIAVAPT' })

      expect(ses.credentials).toBeUndefined()
    })

    it('leaves credentials unset when only the secret is given', async () => {
      const ses = await loadSesConfig({ SES_SECRET_ACCESS_KEY: 'vapt-secret' })

      expect(ses.credentials).toBeUndefined()
    })
  })
})
