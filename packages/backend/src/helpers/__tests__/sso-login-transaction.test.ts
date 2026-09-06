import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  consumeSsoLoginTransaction,
  storeSsoLoginTransaction,
} from '../sso-login-transaction'

const mocks = vi.hoisted(() => ({
  set: vi.fn(),
  getdel: vi.fn(),
}))

vi.mock('@/helpers/redis-app-data', () => ({
  redisAppDataClient: {
    set: mocks.set,
    getdel: mocks.getdel,
  },
}))

describe('sso-login-transaction', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('stores the transaction with a TTL', async () => {
    const transaction = {
      state: 'state',
      nonce: 'nonce',
      codeVerifier: 'a'.repeat(43),
    }
    await storeSsoLoginTransaction('tx-1', transaction)

    expect(mocks.set).toHaveBeenCalledWith(
      'sso-login-tx:tx-1',
      JSON.stringify(transaction),
      'EX',
      600,
    )
  })

  it('consumes the transaction in one Redis operation', async () => {
    const transaction = {
      state: 'state',
      nonce: 'nonce',
      codeVerifier: 'a'.repeat(43),
    }
    mocks.getdel.mockResolvedValueOnce(JSON.stringify(transaction))

    await expect(consumeSsoLoginTransaction('tx-1')).resolves.toEqual(
      transaction,
    )
    expect(mocks.getdel).toHaveBeenCalledWith('sso-login-tx:tx-1')
  })

  it('returns null for an unknown or expired transaction', async () => {
    mocks.getdel.mockResolvedValueOnce(null)
    await expect(consumeSsoLoginTransaction('missing')).resolves.toBeNull()
  })
})
