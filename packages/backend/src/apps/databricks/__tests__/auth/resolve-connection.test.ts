import type { IGlobalVariable } from '@plumber/types'
import { describe, expect, it, vi } from 'vitest'

import { resolveDatabricksConnection } from '../../auth/resolve-connection'

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

vi.mock('../../auth/resolve-credentials', () => ({
  resolveDatabricksCredentials: (generation: 'legacy' | 'new') =>
    generation === 'new' ? CREATED : LEGACY,
}))

function withGeneration(generation: unknown): IGlobalVariable {
  return { auth: { data: { generation } } } as unknown as IGlobalVariable
}

describe('resolveDatabricksConnection', () => {
  it('uses legacy credentials and key when generation is missing', () => {
    expect(resolveDatabricksConnection(withGeneration(undefined))).toEqual({
      generation: 'legacy',
      credentials: LEGACY,
      tokenRedisKey: 'databricks:authToken:legacy-client:legacy.example',
    })
  })

  it('uses new credentials and key for a new row', () => {
    expect(resolveDatabricksConnection(withGeneration('new'))).toEqual({
      generation: 'new',
      credentials: CREATED,
      tokenRedisKey: 'databricks:authToken:new-client:new.example',
    })
  })

  it('throws on an unknown generation', () => {
    expect(() => resolveDatabricksConnection(withGeneration('v3'))).toThrow(
      'Unknown Databricks generation',
    )
  })
})
