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
  const loaded = await import('./resolve-workspace') // pragma: allowlist secret
  return loaded.resolveDatabricksWorkspace // pragma: allowlist secret
}

// oxfmt-ignore
describe('resolveDatabricksWorkspace', () => { // pragma: allowlist secret
  it('returns the legacy host when the caller passes legacy', async () => {
    stubLegacyEnv()
    const resolveDatabricksWorkspace = await loadResolver() // pragma: allowlist secret

    expect(resolveDatabricksWorkspace('legacy')).toEqual(LEGACY) // pragma: allowlist secret
  })

  it('returns the new credentials when the new vars are set', async () => {
    stubLegacyEnv()
    stubNewEnv()
    const resolveDatabricksWorkspace = await loadResolver() // pragma: allowlist secret

    expect(resolveDatabricksWorkspace('new')).toEqual(CREATED) // pragma: allowlist secret
  })

  it('throws when the new hostname is empty', async () => {
    stubLegacyEnv()
    stubNewEnv({ DATABRICKS_NEW_SERVER_HOSTNAME: '' })
    const resolveDatabricksWorkspace = await loadResolver() // pragma: allowlist secret

    // oxfmt-ignore
    expect(() => resolveDatabricksWorkspace('new')).toThrow(/DATABRICKS_NEW_SERVER_HOSTNAME/) // pragma: allowlist secret
    expect(resolveDatabricksWorkspace('legacy')).toEqual(LEGACY) // pragma: allowlist secret
  })
})
