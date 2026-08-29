import axios from 'axios'
import jwt from 'jsonwebtoken'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import appConfig from '@/config/app'
import User from '@/models/user'

import {
  getAdminTokenUser,
  getOrCreateUser,
  parseAdminToken,
  sendOnboardingEmail,
  updateLastLogin,
} from '../auth'

const mockPatchWhere = vi.fn()
const whereUser = vi.fn(() => ({
  first: vi.fn(() => ({
    throwIfNotFound: vi.fn(() => ({ id: 'test-user-id' })),
  })),
}))
const findOne = vi.fn()
const insertAndFetch = vi.fn()
const patch = vi.fn(() => ({
  where: mockPatchWhere,
}))
const findById = vi.fn()

describe('Auth helpers', () => {
  const originalIsProd = appConfig.isProd
  const originalOnboardingEmailWebhookUrl = appConfig.onboardingEmailWebhookUrl

  beforeEach(() => {
    vi.spyOn(User, 'query').mockReturnValue({
      where: whereUser,
      findOne,
      insertAndFetch,
      patch,
      findById,
    } as never)
    vi.spyOn(axios, 'post').mockResolvedValue({ data: {} })
  })

  afterEach(() => {
    appConfig.isProd = originalIsProd
    appConfig.onboardingEmailWebhookUrl = originalOnboardingEmailWebhookUrl
    vi.clearAllMocks()
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

      expect(whereUser).toHaveBeenCalledWith('email', 'coffee@plumber.local')
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

      findOne.mockResolvedValueOnce(existingUser)

      const result = await getOrCreateUser(email)

      expect(findOne).toHaveBeenCalledOnce()
      expect(findOne).toHaveBeenCalledWith({ email: email.toLowerCase() })

      expect(insertAndFetch).not.toHaveBeenCalled() // Ensure no new user was created

      expect(result).toEqual(existingUser)
    })

    it('should create a new user if none exists', async () => {
      const email = 'chef@kitchen.com'
      const newUser = { id: 'new-user-id', email }

      findOne.mockResolvedValueOnce(null) // Simulate no user found
      insertAndFetch.mockResolvedValueOnce(newUser) // Simulate new user creation

      const user = await getOrCreateUser(email)

      expect(findOne).toHaveBeenCalledOnce()
      expect(findOne).toHaveBeenCalledWith({ email: email.toLowerCase() })

      expect(insertAndFetch).toHaveBeenCalledOnce()
      expect(insertAndFetch).toHaveBeenCalledWith({
        email: email.toLowerCase(),
      })

      expect(user).toEqual(newUser)
    })

    it('should trim and lowercase the email before querying', async () => {
      const email = '   Barista@COFFEE.com   '
      const formattedEmail = 'barista@coffee.com'
      const user = { id: 'test-user-id', email: formattedEmail }

      findOne.mockResolvedValueOnce(user)

      const result = await getOrCreateUser(email)

      expect(findOne).toHaveBeenCalledOnce()
      expect(findOne).toHaveBeenCalledWith({ email: formattedEmail })

      expect(result).toEqual(user)
    })

    it('should handle errors from User.query().findOne', async () => {
      const email = 'barista@coffee.com'

      findOne.mockRejectedValueOnce(new Error('Database error'))

      await expect(getOrCreateUser(email)).rejects.toThrow('Database error')

      expect(findOne).toHaveBeenCalledOnce()
      expect(findOne).toHaveBeenCalledWith({ email: email.toLowerCase() })

      expect(insertAndFetch).not.toHaveBeenCalled() // Ensure no insert attempt was made
    })

    it('should handle errors from User.query().insertAndFetch', async () => {
      const email = 'example@domain.com'

      findOne.mockResolvedValueOnce(null) // Simulate no user found
      insertAndFetch.mockRejectedValueOnce(new Error('Insert error'))

      await expect(getOrCreateUser(email)).rejects.toThrow('Insert error')

      expect(findOne).toHaveBeenCalledOnce()
      expect(findOne).toHaveBeenCalledWith({ email: email.toLowerCase() })

      expect(insertAndFetch).toHaveBeenCalledOnce()
      expect(insertAndFetch).toHaveBeenCalledWith({
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
      patch().where.mockResolvedValueOnce(1)

      await updateLastLogin(userId)

      expect(patch).toHaveBeenCalledWith({
        lastLoginAt: expect.any(Date),
      })
      expect(patch().where).toHaveBeenCalledWith({ id: userId })
    })

    it('throws error with no user id', async () => {
      await expect(updateLastLogin('')).rejects.toThrow('User id required')
    })

    it('throws error with non-existent user id', async () => {
      patch().where.mockReturnValueOnce(Promise.resolve(0))
      await expect(updateLastLogin('non-existent-id')).rejects.toThrow(
        'No user found',
      )
    })
  })

  describe('sendOnboardingEmail', () => {
    beforeEach(() => {
      vi.clearAllMocks()
    })

    afterEach(() => {
      vi.clearAllMocks()
      vi.restoreAllMocks()
    })
    it('does not send email if user has logged in before', async () => {
      const mockUser = {
        id: 'test-id',
        email: 'test@example.com',
        lastLoginAt: new Date(),
        createdAt: new Date(),
      } as unknown as User

      findById.mockResolvedValueOnce(mockUser)

      await sendOnboardingEmail(mockUser)
      expect(axios.post).not.toHaveBeenCalled()
    })

    it('does not send email if user was created before release date', async () => {
      const mockUser = {
        id: 'test-id',
        email: 'test@example.com',
        createdAt: new Date('2024-01-01'), // Before release date
      } as unknown as User

      findById.mockResolvedValueOnce(mockUser)

      await sendOnboardingEmail(mockUser)
      expect(axios.post).not.toHaveBeenCalled()
    })

    it('does not send email in non-prod environment', async () => {
      const mockUser = {
        id: 'test-id',
        email: 'test@example.com',
        createdAt: new Date('2025-03-11'), // After release date
      } as unknown as User

      findById.mockResolvedValueOnce(mockUser)

      await sendOnboardingEmail(mockUser)
      expect(axios.post).not.toHaveBeenCalled()
    })

    it('sends email in prod for eligible users', async () => {
      appConfig.isProd = true

      const mockUser = {
        id: 'test-id',
        email: 'test@example.com',
        lastLoginAt: null,
        createdAt: new Date('2025-03-11'), // After release date
      } as unknown as User

      findById.mockResolvedValueOnce(mockUser)
      vi.mocked(axios.post).mockResolvedValueOnce({ data: {} })

      await sendOnboardingEmail(mockUser)

      expect(axios.post).toHaveBeenCalledWith(
        appConfig.onboardingEmailWebhookUrl,
        {
          email: mockUser.email,
        },
      )
    })

    it('does not send email if webhook URL is not configured', async () => {
      appConfig.isProd = true
      appConfig.onboardingEmailWebhookUrl = ''

      const mockUser = {
        id: 'test-id',
        email: 'test@example.com',
        lastLoginAt: null,
        createdAt: new Date('2025-03-11'), // After release date
      } as unknown as User

      findById.mockResolvedValueOnce(mockUser)

      await sendOnboardingEmail(mockUser)
      expect(axios.post).not.toHaveBeenCalled()
    })
  })
})
