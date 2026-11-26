import type { IGlobalVariable } from '@plumber/types'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { createSession } from '../../auth/create-client'

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

const mocks = vi.hoisted(() => ({
  connect: vi.fn(),
  openSession: vi.fn(),
  getDatabricksToken: vi.fn(),
  DBSQLClient: vi.fn(),
}))

vi.mock('@databricks/sql', () => ({
  DBSQLClient: mocks.DBSQLClient,
}))

vi.mock('../../auth/token-persistence', () => ({
  getDatabricksToken: mocks.getDatabricksToken,
}))

vi.mock('../../auth/resolve-credentials', () => ({
  resolveDatabricksCredentials: (generation: 'legacy' | 'new') =>
    generation === 'new' ? CREATED : LEGACY,
}))

function withGeneration(generation: unknown): IGlobalVariable {
  return {
    auth: { data: { generation, screenName: 'user_example_com' } },
  } as unknown as IGlobalVariable
}

describe('createSession', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.DBSQLClient.mockImplementation(function () {
      return { connect: mocks.connect }
    })
    mocks.connect.mockResolvedValue({
      openSession: mocks.openSession,
      close: vi.fn(),
    })
    mocks.openSession.mockResolvedValue({ close: vi.fn() })
    mocks.getDatabricksToken.mockResolvedValue('token-value')
  })

  it.each([
    ['legacy', undefined, LEGACY],
    ['new', 'new', CREATED],
  ] as const)(
    'connects to the %s workspace with its own catalog',
    async (label, generation, credentials) => {
      const result = await createSession(withGeneration(generation))

      expect(mocks.getDatabricksToken).toHaveBeenCalledWith({
        generation: label,
        credentials,
        tokenRedisKey: `databricks:authToken:${credentials.clientId}:${credentials.serverHostname}`,
      })

      expect(mocks.connect).toHaveBeenCalledWith({
        authType: 'access-token',
        host: credentials.serverHostname,
        path: credentials.httpPath,
        token: 'token-value',
      })
      expect(mocks.openSession).toHaveBeenCalledWith({
        initialSchema: 'user_example_com',
        initialCatalog: credentials.catalog,
      })
      expect(result.credentials).toEqual(credentials)
    },
  )

  it('rejects an unknown generation before creating a client', async () => {
    await expect(createSession(withGeneration('v3'))).rejects.toThrow(
      'Unknown Databricks generation',
    )
    expect(mocks.DBSQLClient).not.toHaveBeenCalled()
    expect(mocks.getDatabricksToken).not.toHaveBeenCalled()
  })
})
