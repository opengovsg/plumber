import { afterEach, describe, expect, it, vi } from 'vitest'

const getLdFlagValue = vi.fn()
const connectionTransaction = vi.fn()

vi.mock('@/helpers/launch-darkly', () => ({
  getLdFlagValue: (...args: unknown[]) => getLdFlagValue(...args),
}))

vi.mock('@/models/connection', () => ({
  default: {
    transaction: (...args: unknown[]) => connectionTransaction(...args),
  },
}))

import {
  ensureDatabricksConnection,
  newConnectionCredentials,
} from '../../auth/ensure-new-connection'

const NEW_ENV = {
  DATABRICKS_NEW_SERVER_HOSTNAME: 'new.example',
  DATABRICKS_NEW_HTTP_PATH: '/sql/new',
  DATABRICKS_NEW_CATALOG: 'new_catalog',
  DATABRICKS_NEW_CLIENT_ID: 'new-client',
  DATABRICKS_NEW_CLIENT_SECRET: 'new-client-value',
} as const

afterEach(() => {
  vi.unstubAllEnvs()
  getLdFlagValue.mockReset()
  connectionTransaction.mockReset()
})

function stubNewEnv() {
  for (const [key, value] of Object.entries(NEW_ENV)) {
    vi.stubEnv(key, value)
  }
}

describe('newConnectionCredentials', () => {
  it('returns null when the flag is off', async () => {
    stubNewEnv()
    getLdFlagValue.mockResolvedValue(false)

    await expect(
      newConnectionCredentials('owner@example.com'),
    ).resolves.toBeNull()
    expect(getLdFlagValue).toHaveBeenCalledWith(
      'databricks-new-connection',
      'owner@example.com',
      false,
    )
  })

  it('returns the new credentials when the flag is on', async () => {
    stubNewEnv()
    getLdFlagValue.mockResolvedValue(true)

    await expect(
      newConnectionCredentials('owner@example.com'),
    ).resolves.toEqual({
      serverHostname: 'new.example',
      httpPath: '/sql/new',
      catalog: 'new_catalog',
      clientId: 'new-client',
      clientSecret: 'new-client-value',
    })
  })

  it('returns null when the flag is on but the new credentials are missing', async () => {
    stubNewEnv()
    vi.stubEnv('DATABRICKS_NEW_SERVER_HOSTNAME', '')
    getLdFlagValue.mockResolvedValue(true)

    await expect(
      newConnectionCredentials('owner@example.com'),
    ).resolves.toBeNull()
  })
})

describe('ensureDatabricksConnection', () => {
  it('opens the transaction only after the flag resolves', async () => {
    stubNewEnv()
    let resolveFlag: (value: boolean) => void = () => undefined
    getLdFlagValue.mockReturnValue(
      new Promise<boolean>((resolve) => {
        resolveFlag = resolve
      }),
    )
    connectionTransaction.mockImplementation(
      async (fn: (trx: unknown) => unknown) =>
        fn({ raw: async (): Promise<void> => undefined }),
    )
    const user = {
      id: 'user-1',
      email: 'owner@example.com',
      $relatedQuery: () => ({
        where: async () => [{ formattedData: { generation: 'legacy' } }],
      }),
    }

    const pending = ensureDatabricksConnection(user as never, false)
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(connectionTransaction).not.toHaveBeenCalled()

    resolveFlag(false)
    await pending
    expect(connectionTransaction).toHaveBeenCalledTimes(1)
  })
})
