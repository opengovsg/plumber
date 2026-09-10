import { afterEach, describe, expect, it, vi } from 'vitest'

import { setCurrentUserContext } from '../authentication'

const mocks = vi.hoisted(() => ({
  getAdminTokenUser: vi.fn(),
  getLoggedInUser: vi.fn(),
  parseAdminToken: vi.fn(),
}))

vi.mock('@/helpers/auth', () => ({
  getAdminTokenUser: mocks.getAdminTokenUser,
  getLoggedInUser: mocks.getLoggedInUser,
  parseAdminToken: mocks.parseAdminToken,
}))

describe('GraphQL Authentication', () => {
  afterEach(() => {
    vi.clearAllMocks()
    vi.restoreAllMocks()
  })

  describe('setCurrentUserContext', () => {
    it('parses admin token if available', async () => {
      mocks.parseAdminToken.mockReturnValueOnce({
        userEmail: 'test@plumber.local',
      })
      mocks.getAdminTokenUser.mockReturnValueOnce({
        id: 'test-user-id',
      })

      const result = await setCurrentUserContext({
        req: {
          headers: {
            'x-plumber-admin-token': 'test-token',
          },
        },
      } as unknown as any)
      expect(mocks.parseAdminToken).toHaveBeenCalled()
      expect(mocks.getAdminTokenUser).toHaveBeenCalled()
      expect(result.currentUser.id).toEqual('test-user-id')
    })

    it('does not invoke admin-related functions if admin header not set', async () => {
      await setCurrentUserContext({ req: { headers: {} } } as unknown as any)
      expect(mocks.parseAdminToken).not.toHaveBeenCalled()
      expect(mocks.getAdminTokenUser).not.toHaveBeenCalled()
    })
  })
})
