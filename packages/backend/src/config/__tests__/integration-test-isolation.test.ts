import { afterEach, describe, expect, it, vi } from 'vitest'

async function loadIsolation() {
  vi.resetModules()
  const { integrationTestIsolation } =
    await import('../integration-test-isolation')
  return integrationTestIsolation
}

describe('integrationTestIsolation', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('ignores the isolation vars outside vitest', async () => {
    vi.stubEnv('VITEST', '')
    vi.stubEnv('REDIS_DB_OFFSET', '7')
    vi.stubEnv('DYNAMODB_TABLE_SUFFIX', 'w1')

    expect(await loadIsolation()).toEqual({
      REDIS_DB_OFFSET: 0,
      DYNAMODB_TABLE_SUFFIX: undefined,
    })
  })

  it('reads the isolation vars under vitest', async () => {
    vi.stubEnv('REDIS_DB_OFFSET', '10')
    vi.stubEnv('DYNAMODB_TABLE_SUFFIX', 'w2')

    expect(await loadIsolation()).toEqual({
      REDIS_DB_OFFSET: 10,
      DYNAMODB_TABLE_SUFFIX: 'w2',
    })
  })

  it('rejects a non-numeric redis offset under vitest', async () => {
    vi.stubEnv('REDIS_DB_OFFSET', 'abc')

    await expect(loadIsolation()).rejects.toThrow()
  })
})
