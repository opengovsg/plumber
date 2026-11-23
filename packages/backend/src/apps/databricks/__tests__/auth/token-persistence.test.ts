import axios from 'axios'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { getDatabricksToken } from '../../auth/token-persistence'

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  set: vi.fn(),
}))

vi.mock('@/config/redis', () => ({
  createRedisClient: () => ({ get: mocks.get, set: mocks.set }),
  REDIS_DB_INDEX: { APP_DATA: 0 },
}))

vi.mock('axios', () => ({
  default: { post: vi.fn() },
}))

const CONNECTION = {
  generation: 'new' as const,
  credentials: {
    serverHostname: 'new.example',
    httpPath: '/sql/new',
    catalog: 'new_catalog',
    clientId: 'new-client',
    clientSecret: 'new-client-value',
  },
  tokenRedisKey: 'given-key',
}

describe('getDatabricksToken', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns the cached token under the given key', async () => {
    mocks.get.mockResolvedValue('cached-token')

    await expect(getDatabricksToken(CONNECTION)).resolves.toBe('cached-token')
    expect(mocks.get).toHaveBeenCalledWith('given-key')
    expect(axios.post).not.toHaveBeenCalled()
  })

  it('stores a fetched token under the given key', async () => {
    mocks.get.mockResolvedValue(null)
    vi.mocked(axios.post).mockResolvedValue({
      data: { access_token: 'fresh-token-value', expires_in: 3600 },
    })

    await expect(getDatabricksToken(CONNECTION)).resolves.toBe(
      'fresh-token-value',
    )
    expect(axios.post).toHaveBeenCalledWith(
      '/oidc/v1/token',
      expect.any(URLSearchParams),
      expect.objectContaining({
        baseURL: 'https://new.example',
        auth: { username: 'new-client', password: 'new-client-value' },
      }),
    )
    expect(mocks.set).toHaveBeenCalledWith(
      'given-key',
      'fresh-token-value',
      'EX',
      3540,
    )
  })
})
