import jwt from 'jsonwebtoken'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import appConfig from '@/config/app'

import {
  getAdminTokenUser,
  getOrCreateUser,
  parseAdminToken,
  updateLastLogin,
} from '../auth'

const mockPatchWhere = vi.fn()

const mocks = vi.hoisted(() => ({
  whereUser: vi.fn(() => ({
    first: vi.fn(() => ({
      throwIfNotFound: vi.fn(() => ({ id: 'test-user-id' })),
    })),
  })),
  findOne: vi.fn(),
  insertAndFetch: vi.fn(),
  patch: vi.fn(() => ({
    where: mockPatchWhere,
  })),
}))

vi.mock('@/models/user', () => ({
  default: {
    query: vi.fn(() => ({
      where: mocks.whereUser,
      findOne: mocks.findOne,
      insertAndFetch: mocks.insertAndFetch,
      patch: mocks.patch,
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

  describe('getOrCreateUser', () => {
    afterEach(() => {
      vi.clearAllMocks() // Clear mocks after each test
    })

    it('should return an existing user if found', async () => {
      const email = 'barista@coffee.com'
      const existingUser = { id: 'test-user-id', email }

      mocks.findOne.mockResolvedValueOnce(existingUser)

      const result = await getOrCreateUser(email)

      expect(mocks.findOne).toHaveBeenCalledOnce()
      expect(mocks.findOne).toHaveBeenCalledWith({ email: email.toLowerCase() })

      expect(mocks.insertAndFetch).not.toHaveBeenCalled() // Ensure no new user was created

      expect(result).toEqual(existingUser)
    })

    it('should create a new user if none exists', async () => {
      const email = 'chef@kitchen.com'
      const newUser = { id: 'new-user-id', email }

      mocks.findOne.mockResolvedValueOnce(null) // Simulate no user found
      mocks.insertAndFetch.mockResolvedValueOnce(newUser) // Simulate new user creation

      const user = await getOrCreateUser(email)

      expect(mocks.findOne).toHaveBeenCalledOnce()
      expect(mocks.findOne).toHaveBeenCalledWith({ email: email.toLowerCase() })

      expect(mocks.insertAndFetch).toHaveBeenCalledOnce()
      expect(mocks.insertAndFetch).toHaveBeenCalledWith({
        email: email.toLowerCase(),
      })

      expect(user).toEqual(newUser)
    })

    it('should trim and lowercase the email before querying', async () => {
      const email = '   Barista@COFFEE.com   '
      const formattedEmail = 'barista@coffee.com'
      const user = { id: 'test-user-id', email: formattedEmail }

      mocks.findOne.mockResolvedValueOnce(user)

      const result = await getOrCreateUser(email)

      expect(mocks.findOne).toHaveBeenCalledOnce()
      expect(mocks.findOne).toHaveBeenCalledWith({ email: formattedEmail })

      expect(result).toEqual(user)
    })

    it('should handle errors from User.query().findOne', async () => {
      const email = 'barista@coffee.com'

      mocks.findOne.mockRejectedValueOnce(new Error('Database error'))

      await expect(getOrCreateUser(email)).rejects.toThrowError(
        'Database error',
      )

      expect(mocks.findOne).toHaveBeenCalledOnce()
      expect(mocks.findOne).toHaveBeenCalledWith({ email: email.toLowerCase() })

      expect(mocks.insertAndFetch).not.toHaveBeenCalled() // Ensure no insert attempt was made
    })

    it('should handle errors from User.query().insertAndFetch', async () => {
      const email = 'example@domain.com'

      mocks.findOne.mockResolvedValueOnce(null) // Simulate no user found
      mocks.insertAndFetch.mockRejectedValueOnce(new Error('Insert error'))

      await expect(getOrCreateUser(email)).rejects.toThrowError('Insert error')

      expect(mocks.findOne).toHaveBeenCalledOnce()
      expect(mocks.findOne).toHaveBeenCalledWith({ email: email.toLowerCase() })

      expect(mocks.insertAndFetch).toHaveBeenCalledOnce()
      expect(mocks.insertAndFetch).toHaveBeenCalledWith({
        email: email.toLowerCase(),
      })
    })
  })

  describe('updateLastLogin', () => {
    afterEach(() => {
      vi.clearAllMocks() // Clear mocks after each test
    })

    it('patch with correct id and date', async () => {
      const userId = 'test-user-id'
      mocks.patch().where.mockResolvedValueOnce(1)

      await updateLastLogin(userId)

      expect(mocks.patch).toHaveBeenCalledWith({
        lastLoginAt: expect.any(Date),
      })
      expect(mocks.patch().where).toHaveBeenCalledWith({ id: userId })
    })

    it('throws error with no user id', async () => {
      await expect(updateLastLogin('')).rejects.toThrowError('User id required')
    })

    it('throws error with non-existent user id', async () => {
      mocks.patch().where.mockReturnValueOnce(Promise.resolve(0))
      await expect(updateLastLogin('non-existent-id')).rejects.toThrowError(
        'No user found',
      )
    })
  })
})
