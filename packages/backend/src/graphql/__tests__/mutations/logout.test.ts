import { afterEach, describe, expect, it, vi } from 'vitest'

import logout from '@/graphql/mutations/logout'
import type Context from '@/types/express/context'

const mocks = vi.hoisted(() => ({
  getParsedAuthCookie: vi.fn(),
  invalidateAuthCookie: vi.fn(),
  deleteAuthCookie: vi.fn(),
}))

const STUB_CONTEXT = {
  res: {
    clearCookie: vi.fn(),
  },
  req: {
    cookies: { 'plumber.sid': 'stub-token' },
  },
} as unknown as Context

vi.mock('@/helpers/auth', () => ({
  getParsedAuthCookie: mocks.getParsedAuthCookie,
  invalidateAuthCookie: mocks.invalidateAuthCookie,
  deleteAuthCookie: mocks.deleteAuthCookie,
}))

describe('logout', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('revokes the token server-side before clearing the cookie, then reports isSso', async () => {
    mocks.getParsedAuthCookie.mockReturnValueOnce({
      userId: 'user-1',
      isSso: true,
    })
    const callOrder: string[] = []
    mocks.invalidateAuthCookie.mockImplementationOnce(async () => {
      callOrder.push('invalidate')
    })
    mocks.deleteAuthCookie.mockImplementationOnce(() => {
      callOrder.push('delete')
    })

    const result = await logout(null, {}, STUB_CONTEXT)

    expect(callOrder).toEqual(['invalidate', 'delete'])
    expect(result).toEqual({ isSso: true })
  })

  it('does not clear the cookie and propagates the error when revocation fails', async () => {
    mocks.getParsedAuthCookie.mockReturnValueOnce({ userId: 'user-1' })
    mocks.invalidateAuthCookie.mockRejectedValueOnce(new Error('redis down'))

    await expect(logout(null, {}, STUB_CONTEXT)).rejects.toThrow('redis down')
    expect(mocks.deleteAuthCookie).not.toHaveBeenCalled()
  })
})
