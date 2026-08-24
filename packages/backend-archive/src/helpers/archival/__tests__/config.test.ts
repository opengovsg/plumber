import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Prevent dotenv from loading the local .env file during tests — config.ts
// re-executes `import 'dotenv/config'` on every vi.resetModules() + import(),
// which would restore deleted env vars from .env and break the "throws when X
// is absent" assertions.
vi.mock('dotenv/config', () => ({}))

describe('archival/config', () => {
  const REQUIRED_ENV: Record<string, string> = {
    ARCHIVE_POSTGRES_READER_HOST: 'test-reader.internal',
    ARCHIVE_BUCKET: 'test-bucket',
    ARCHIVE_MAX_RUNTIME_MS: '14400000',
    POSTGRES_HOST: 'prod-host.internal',
    POSTGRES_DATABASE: 'plumber',
    POSTGRES_USERNAME: 'app_user',
  }

  beforeEach(() => {
    vi.resetModules()
    for (const [k, v] of Object.entries(REQUIRED_ENV)) {
      process.env[k] = v
    }
    // Ensure we're in non-dev mode unless a test overrides this
    process.env.APP_ENV = 'production'
  })

  afterEach(() => {
    for (const k of Object.keys(REQUIRED_ENV)) {
      delete process.env[k]
    }
    delete process.env.APP_ENV
    delete process.env.RDS_PROXY_HOST
    delete process.env.ARCHIVE_MAX_RUNTIME_MS
  })

  describe('requireIntStrict fields', () => {
    it('reads archiveMaxRuntimeMs from ARCHIVE_MAX_RUNTIME_MS', async () => {
      const { archivalConfig } = await import('../config.js')
      expect(archivalConfig.archiveMaxRuntimeMs).toBe(14400000)
    })

    it('throws when ARCHIVE_MAX_RUNTIME_MS is not set', async () => {
      delete process.env.ARCHIVE_MAX_RUNTIME_MS
      await expect(import('../config.js')).rejects.toThrow(
        'ARCHIVE_MAX_RUNTIME_MS',
      )
    })

    it('throws when ARCHIVE_MAX_RUNTIME_MS is not a valid integer', async () => {
      process.env.ARCHIVE_MAX_RUNTIME_MS = 'not-a-number'
      await expect(import('../config.js')).rejects.toThrow(
        'ARCHIVE_MAX_RUNTIME_MS',
      )
    })
  })

  describe('requireString fields', () => {
    it('reads postgresReaderHost from ARCHIVE_POSTGRES_READER_HOST', async () => {
      const { archivalConfig } = await import('../config.js')
      expect(archivalConfig.postgresReaderHost).toBe('test-reader.internal')
    })

    it('throws when ARCHIVE_POSTGRES_READER_HOST is not set', async () => {
      delete process.env.ARCHIVE_POSTGRES_READER_HOST
      await expect(import('../config.js')).rejects.toThrow(
        'ARCHIVE_POSTGRES_READER_HOST',
      )
    })
  })

  describe('devString fields in non-dev', () => {
    it('uses POSTGRES_HOST when set', async () => {
      const { archivalConfig } = await import('../config.js')
      expect(archivalConfig.postgresHost).toBe('prod-host.internal')
    })

    it('prefers RDS_PROXY_HOST over POSTGRES_HOST', async () => {
      process.env.RDS_PROXY_HOST = 'rds-proxy.internal'
      const { archivalConfig } = await import('../config.js')
      expect(archivalConfig.postgresHost).toBe('rds-proxy.internal')
    })

    it('throws when POSTGRES_HOST is absent in non-dev', async () => {
      delete process.env.POSTGRES_HOST
      await expect(import('../config.js')).rejects.toThrow('POSTGRES_HOST')
    })

    it('throws when POSTGRES_DATABASE is absent in non-dev', async () => {
      delete process.env.POSTGRES_DATABASE
      await expect(import('../config.js')).rejects.toThrow('POSTGRES_DATABASE')
    })

    it('throws when POSTGRES_USERNAME is absent in non-dev', async () => {
      delete process.env.POSTGRES_USERNAME
      await expect(import('../config.js')).rejects.toThrow('POSTGRES_USERNAME')
    })
  })

  describe('devString fields in dev', () => {
    beforeEach(() => {
      process.env.APP_ENV = 'development'
      delete process.env.POSTGRES_HOST
      delete process.env.POSTGRES_DATABASE
      delete process.env.POSTGRES_USERNAME
    })

    it('falls back to localhost for postgresHost', async () => {
      const { archivalConfig } = await import('../config.js')
      expect(archivalConfig.postgresHost).toBe('localhost')
    })

    it('falls back to plumber_dev for postgresDatabase', async () => {
      const { archivalConfig } = await import('../config.js')
      expect(archivalConfig.postgresDatabase).toBe('plumber_dev')
    })

    it('falls back to postgres for postgresUsername', async () => {
      const { archivalConfig } = await import('../config.js')
      expect(archivalConfig.postgresUsername).toBe('postgres')
    })
  })
})
