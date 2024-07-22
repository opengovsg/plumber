import jwt from 'jsonwebtoken'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import appConfig from '@/config/app'

import { getAdminTokenUser, parseAdminToken } from '../auth'

const mocks = vi.hoisted(() => ({
  whereUser: vi.fn(() => ({
    first: vi.fn(() => ({
      throwIfNotFound: vi.fn(() => ({ id: 'test-user-id' })),
    })),
  })),
}))

vi.mock('@/models/user', () => ({
  default: {
    query: vi.fn(() => ({
      where: mocks.whereUser,
    })),
  },
}))

describe('Auth helpers', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('parseAdminToken', () => {
    beforeEach(() => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('01 June 2024 00:00:00 GMT+8'))
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('can parse valid admin tokens', () => {
      const token = jwt.sign(
        { userEmail: 'coffee@plumber.local' },
        appConfig.adminJwtSecretKey,
        {
          expiresIn: 60,
        },
      )
      const result = parseAdminToken(token)
      expect(result.userEmail).toEqual('coffee@plumber.local')
    })

    it('does not accept tokens past a certain age', () => {
      const token = jwt.sign(
        { userEmail: 'coffee@plumber.local' },
        appConfig.adminJwtSecretKey,
      )

      vi.setSystemTime(Date.now() + 1000 * 60 * 60 * 24)
      expect(parseAdminToken(token)).toBeNull()
    })
  })

  describe('getAdminTokenUser', () => {
    it('queries for the user with the email in the token', async () => {
      const result = await getAdminTokenUser({
        userEmail: 'coffee@plumber.local',
      })

      expect(mocks.whereUser).toBeCalledWith('email', 'coffee@plumber.local')
      expect(result.id).toEqual('test-user-id')
    })
  })
})
