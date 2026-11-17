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
  isDatabricksNewEnabled,
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

describe('isDatabricksNewEnabled', () => {
  it('returns false when the override is false', async () => {
    vi.stubEnv('DATABRICKS_NEW_CONNECTION_ENABLED', 'false')

    await expect(isDatabricksNewEnabled('owner@example.com')).resolves.toBe(
      false,
    )
    expect(getLdFlagValue).not.toHaveBeenCalled()
  })

  it('returns true outside production when the override is true', async () => {
    stubNewEnv()
    vi.stubEnv('APP_ENV', 'development')
    vi.stubEnv('DATABRICKS_NEW_CONNECTION_ENABLED', 'true')

    await expect(isDatabricksNewEnabled('owner@example.com')).resolves.toBe(
      true,
    )
    expect(getLdFlagValue).not.toHaveBeenCalled()
  })

  it('ignores a true override in production', async () => {
    stubNewEnv()
    vi.stubEnv('APP_ENV', 'prod')
    vi.stubEnv('DATABRICKS_NEW_CONNECTION_ENABLED', 'true')
    getLdFlagValue.mockResolvedValue(false)

    await expect(isDatabricksNewEnabled('owner@example.com')).resolves.toBe(
      false,
    )
    expect(getLdFlagValue).toHaveBeenCalled()
  })

  it('uses the flag when the override is empty', async () => {
    stubNewEnv()
    vi.stubEnv('DATABRICKS_NEW_CONNECTION_ENABLED', '')
    getLdFlagValue.mockResolvedValue(true)

    await expect(isDatabricksNewEnabled('owner@example.com')).resolves.toBe(
      true,
    )
    expect(getLdFlagValue).toHaveBeenCalledWith(
      'databricks-new-connection',
      'owner@example.com',
      false,
    )
  })
})

describe('ensureDatabricksConnection', () => {
  it('reads the gate before opening a transaction', async () => {
    stubNewEnv()
    vi.stubEnv('DATABRICKS_NEW_CONNECTION_ENABLED', '')
    const order: string[] = []
    getLdFlagValue.mockImplementation(async () => {
      order.push('flag')
      return false
    })
    connectionTransaction.mockImplementation(
      async (fn: (trx: unknown) => unknown) => {
        order.push('transaction')
        return fn({ raw: async (): Promise<void> => undefined })
      },
    )
    const user = {
      id: 'user-1',
      email: 'owner@example.com',
      $relatedQuery: () => ({
        where: async () => [{ formattedData: { generation: 'legacy' } }],
      }),
    }

    await ensureDatabricksConnection(user as never, false)

    expect(order).toEqual(['flag', 'transaction'])
  })
})
