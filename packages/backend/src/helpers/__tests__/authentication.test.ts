import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import * as auth from '@/helpers/auth'

import { setCurrentUserContext } from '../authentication'

const getAdminTokenUser = vi.fn()
const getLoggedInUser = vi.fn()
const parseAdminToken = vi.fn()

describe('GraphQL Authentication', () => {
  beforeEach(() => {
    vi.spyOn(auth, 'getAdminTokenUser').mockImplementation(getAdminTokenUser)
    vi.spyOn(auth, 'getLoggedInUser').mockImplementation(getLoggedInUser)
    vi.spyOn(auth, 'parseAdminToken').mockImplementation(parseAdminToken)
  })

  afterEach(() => {
    vi.clearAllMocks()
    vi.restoreAllMocks()
  })

  describe('setCurrentUserContext', () => {
    it('parses admin token if available', async () => {
      parseAdminToken.mockReturnValueOnce({
        userEmail: 'test@plumber.local',
      })
      getAdminTokenUser.mockReturnValueOnce({
        id: 'test-user-id',
      })

      const result = await setCurrentUserContext({
        req: {
          headers: {
            'x-plumber-admin-token': 'test-token',
          },
        },
      } as unknown as any)
      expect(parseAdminToken).toHaveBeenCalled()
      expect(getAdminTokenUser).toHaveBeenCalled()
      expect(result.currentUser.id).toEqual('test-user-id')
    })

    it('does not invoke admin-related functions if admin header not set', async () => {
      await setCurrentUserContext({ req: { headers: {} } } as unknown as any)
      expect(parseAdminToken).not.toHaveBeenCalled()
      expect(getAdminTokenUser).not.toHaveBeenCalled()
    })
  })
})
