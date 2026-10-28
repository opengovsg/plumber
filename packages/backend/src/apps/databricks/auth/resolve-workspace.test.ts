import { afterEach, describe, expect, it, vi } from 'vitest'

import { resolveDatabricksWorkspace } from './resolve-workspace' // pragma: allowlist secret

const CALLS = 1000
const ONE_MS_NS = 1_000_000n

const NEW_ENV = {
  DATABRICKS_NEW_SERVER_HOSTNAME: 'new.example',
  DATABRICKS_NEW_HTTP_PATH: '/sql/new',
  DATABRICKS_NEW_CATALOG: 'new_catalog',
  DATABRICKS_NEW_CLIENT_ID: 'new-client',
  DATABRICKS_NEW_CLIENT_SECRET: 'new-client-value',
} as const

// oxfmt-ignore
type ResolvedCredentials = ReturnType<typeof resolveDatabricksWorkspace> // pragma: allowlist secret

afterEach(() => {
  vi.unstubAllEnvs()
})

function stubNewEnv(
  overrides: Partial<Record<keyof typeof NEW_ENV, string>> = {},
) {
  const values = { ...NEW_ENV, ...overrides }
  for (const [key, value] of Object.entries(values)) {
    vi.stubEnv(key, value)
  }
}

function matchesLegacy(credentials: ResolvedCredentials): boolean {
  return (
    credentials.serverHostname === process.env.DATABRICKS_SERVER_HOSTNAME &&
    credentials.httpPath === process.env.DATABRICKS_HTTP_PATH &&
    credentials.catalog === process.env.DATABRICKS_CATALOG &&
    credentials.clientId === process.env.DATABRICKS_CLIENT_ID &&
    credentials.clientSecret === process.env.DATABRICKS_CLIENT_SECRET &&
    credentials.serverHostname.length > 0
  )
}

function matchesNew(credentials: ResolvedCredentials): boolean {
  return (
    credentials.serverHostname === process.env.DATABRICKS_NEW_SERVER_HOSTNAME &&
    credentials.httpPath === process.env.DATABRICKS_NEW_HTTP_PATH &&
    credentials.catalog === process.env.DATABRICKS_NEW_CATALOG &&
    credentials.clientId === process.env.DATABRICKS_NEW_CLIENT_ID &&
    credentials.clientSecret === process.env.DATABRICKS_NEW_CLIENT_SECRET &&
    credentials.serverHostname.length > 0
  )
}

function maxResolveNs(
  generation: 'legacy' | 'new',
  matches: (credentials: ResolvedCredentials) => boolean,
): bigint {
  let maxNs = 0n
  for (let i = 0; i < CALLS; i++) {
    const start = process.hrtime.bigint()
    // oxfmt-ignore
    const credentials = resolveDatabricksWorkspace(generation) // pragma: allowlist secret
    const elapsedNs = process.hrtime.bigint() - start
    if (elapsedNs > maxNs) {
      maxNs = elapsedNs
    }
    if (!matches(credentials)) {
      throw new Error('resolved credentials did not match the environment')
    }
  }
  return maxNs
}

// oxfmt-ignore
describe('resolveDatabricksWorkspace', () => { // pragma: allowlist secret
  it('returns the legacy host when the caller passes legacy', () => {
    // oxfmt-ignore
    const credentials = resolveDatabricksWorkspace('legacy') // pragma: allowlist secret

    expect(matchesLegacy(credentials)).toBe(true)
    expect(
      credentials.serverHostname === process.env.DATABRICKS_SERVER_HOSTNAME,
    ).toBe(true)
  })

  it('returns the new credentials when the new vars are set', () => {
    stubNewEnv()

    // oxfmt-ignore
    const credentials = resolveDatabricksWorkspace('new') // pragma: allowlist secret

    expect(matchesNew(credentials)).toBe(true)
  })

  it('throws when the new hostname is empty', () => {
    stubNewEnv({ DATABRICKS_NEW_SERVER_HOSTNAME: '' })

    // oxfmt-ignore
    expect(() => resolveDatabricksWorkspace('new')).toThrow() // pragma: allowlist secret
    // oxfmt-ignore
    expect(matchesLegacy(resolveDatabricksWorkspace('legacy'))).toBe(true) // pragma: allowlist secret
  })

  it('resolves 1000 legacy and 1000 new calls in under 1ms each', () => {
    stubNewEnv()

    const legacyMaxNs = maxResolveNs('legacy', matchesLegacy)
    const newMaxNs = maxResolveNs('new', matchesNew)

    expect(legacyMaxNs < ONE_MS_NS).toBe(true)
    expect(newMaxNs < ONE_MS_NS).toBe(true)
  })
})
