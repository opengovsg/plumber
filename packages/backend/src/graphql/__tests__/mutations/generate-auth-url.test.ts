import { afterEach, describe, expect, it, vi } from 'vitest'

import GenerateAuthUrlError from '@/errors/generate-auth-url'
import generateAuthUrl from '@/graphql/mutations/generate-auth-url'
import type Context from '@/types/express/context'

const mocks = vi.hoisted(() => ({
  getConnection: vi.fn(),
  findOneByKey: vi.fn(),
  globalVariable: vi.fn(),
  axiosGet: vi.fn(),
}))

vi.mock('@/services/connection', () => ({
  getConnection: mocks.getConnection,
}))

vi.mock('@/models/app', () => ({
  default: { findOneByKey: mocks.findOneByKey },
}))

vi.mock('@/helpers/global-variable', () => ({
  default: mocks.globalVariable,
}))

vi.mock('axios', () => ({
  default: { get: mocks.axiosGet },
}))

const CURRENT_USER_ID = 'user-1'

const STUB_CONTEXT = {
  currentUser: {
    id: CURRENT_USER_ID,
    withAccessibleFlows: () => ({
      findById: () => ({
        throwIfNotFound: async () => ({ role: 'owner' }),
      }),
    }),
  },
} as unknown as Context

const PARAMS = { input: { id: 'connection-1', flowId: 'flow-1' } }

describe('generateAuthUrl', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  // Regression: a dynamic directory import of the app's auth module fails
  // under native ESM loading, so the resolver must use the App registry.
  it('generates the auth URL through the app registry', async () => {
    const formattedData = { url: 'https://slack.com/oauth' }
    const app = { auth: { generateAuthUrl: vi.fn() } }
    const $ = { stub: true }
    mocks.getConnection.mockResolvedValueOnce({
      key: 'slack',
      userId: CURRENT_USER_ID,
      formattedData,
    })
    mocks.findOneByKey.mockResolvedValueOnce(app)
    mocks.globalVariable.mockResolvedValueOnce($)

    const result = await generateAuthUrl(null, PARAMS, STUB_CONTEXT, null)

    expect(mocks.findOneByKey).toHaveBeenCalledWith('slack')
    expect(app.auth.generateAuthUrl).toHaveBeenCalledWith($)
    expect(mocks.axiosGet).toHaveBeenCalledWith(formattedData.url)
    expect(result).toBe(formattedData)
  })

  it('wraps auth URL generation failures in GenerateAuthUrlError', async () => {
    const app = {
      auth: { generateAuthUrl: vi.fn().mockRejectedValue(new Error('boom')) },
    }
    mocks.getConnection.mockResolvedValueOnce({
      key: 'slack',
      userId: CURRENT_USER_ID,
      formattedData: { url: 'https://slack.com/oauth' },
    })
    mocks.findOneByKey.mockResolvedValueOnce(app)
    mocks.globalVariable.mockResolvedValueOnce({})

    await expect(
      generateAuthUrl(null, PARAMS, STUB_CONTEXT, null),
    ).rejects.toBeInstanceOf(GenerateAuthUrlError)
  })
})
