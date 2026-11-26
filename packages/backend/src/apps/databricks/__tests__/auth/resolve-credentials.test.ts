import { afterEach, describe, expect, it, vi } from 'vitest'

const LEGACY = {
  serverHostname: 'legacy.example',
  httpPath: '/sql/legacy',
  catalog: 'legacy_catalog',
  clientId: 'legacy-client',
  clientSecret: 'legacy-client-value',
}

const CREATED = {
  serverHostname: 'new.example',
  httpPath: '/sql/new',
  catalog: 'new_catalog',
  clientId: 'new-client',
  clientSecret: 'new-client-value',
}

afterEach(() => {
  vi.unstubAllEnvs()
  vi.resetModules()
})

function stubLegacyEnv() {
  vi.stubEnv('DATABRICKS_SERVER_HOSTNAME', LEGACY.serverHostname)
  vi.stubEnv('DATABRICKS_HTTP_PATH', LEGACY.httpPath)
  vi.stubEnv('DATABRICKS_CATALOG', LEGACY.catalog)
  vi.stubEnv('DATABRICKS_CLIENT_ID', LEGACY.clientId)
  vi.stubEnv('DATABRICKS_CLIENT_SECRET', LEGACY.clientSecret)
}

function stubNewEnv(overrides: Partial<Record<string, string>> = {}) {
  const values = {
    DATABRICKS_NEW_SERVER_HOSTNAME: CREATED.serverHostname,
    DATABRICKS_NEW_HTTP_PATH: CREATED.httpPath,
    DATABRICKS_NEW_CATALOG: CREATED.catalog,
    DATABRICKS_NEW_CLIENT_ID: CREATED.clientId,
    DATABRICKS_NEW_CLIENT_SECRET: CREATED.clientSecret,
    ...overrides,
  }
  for (const [key, value] of Object.entries(values)) {
    vi.stubEnv(key, value)
  }
}

async function loadResolver() {
  vi.resetModules()
  const loaded = await import('../../auth/resolve-credentials')
  return loaded.resolveDatabricksCredentials
}

describe('resolveDatabricksCredentials', () => {
  it('returns the legacy host when the caller passes legacy', async () => {
    stubLegacyEnv()
    const resolve = await loadResolver()

    expect(resolve('legacy')).toEqual(LEGACY)
  })

  it('returns the new credentials when the new vars are set', async () => {
    stubLegacyEnv()
    stubNewEnv()
    const resolve = await loadResolver()

    expect(resolve('new')).toEqual(CREATED)
  })

  it('throws when the new hostname is empty', async () => {
    stubLegacyEnv()
    stubNewEnv({ DATABRICKS_NEW_SERVER_HOSTNAME: '' })
    const resolve = await loadResolver()

    expect(() => resolve('new')).toThrow(/DATABRICKS_NEW_SERVER_HOSTNAME/)
  })

  it('freezes the legacy and new credentials', async () => {
    stubLegacyEnv()
    stubNewEnv()
    const resolve = await loadResolver()

    expect(Object.isFrozen(resolve('legacy'))).toBe(true)
    expect(Object.isFrozen(resolve('new'))).toBe(true)
  })
})
