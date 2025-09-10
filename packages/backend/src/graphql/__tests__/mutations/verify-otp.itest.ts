import { beforeEach, describe, expect, it, vi } from 'vitest'

import verifyOtp from '@/graphql/mutations/verify-otp'
import User from '@/models/user'
import Context from '@/types/express/context'

import { generateMockContext } from './tiles/table.mock'

const TEST_OTP = '123456'

const mocks = vi.hoisted(() => ({
  setAuthCookie: vi.fn(),
  sendOnboardingEmail: vi.fn(),
}))

vi.mock('@/helpers/auth', () => ({
  setAuthCookie: mocks.setAuthCookie,
  sendOnboardingEmail: mocks.sendOnboardingEmail,
}))

describe('verifyOtp', () => {
  let context: Context
  let validOtpHash: string
  let user: User

  beforeEach(async () => {
    vi.resetAllMocks()
    context = await generateMockContext()

    user = await User.query().findOne({
      email: context.currentUser.email,
    })

    validOtpHash = user.hashOtp(TEST_OTP)
  })

  it('should throw error when is not gov.sg email', async () => {
    await expect(
      verifyOtp(
        null,
        { input: { otp: '123456', email: 'test@example.com' } },
        context,
      ),
    ).rejects.toThrow('Only .gov.sg emails are allowed.')
  })

  it('should throw error when no otp provided', async () => {
    await expect(
      verifyOtp(
        null,
        { input: { otp: '', email: context.currentUser.email } },
        context,
      ),
    ).rejects.toThrow('No OTP provided')
  })

  it('should throw error when no user found', async () => {
    await expect(
      verifyOtp(
        null,
        { input: { otp: '123456', email: 'non-existent-user@open.gov.sg' } },
        context,
      ),
    ).rejects.toThrow('No such user')
  })

  it('should throw error when no otp sent', async () => {
    await User.query()
      .patch({ otpHash: 'some-hash' })
      .where({ email: context.currentUser.email })
    await expect(
      verifyOtp(
        null,
        { input: { otp: '123456', email: context.currentUser.email } },
        context,
      ),
    ).rejects.toThrow('No OTP sent')
  })

  it('should throw error when no otp sent', async () => {
    await User.query()
      .patch({ otpSentAt: new Date() })
      .where({ email: context.currentUser.email })
    await expect(
      verifyOtp(
        null,
        { input: { otp: '123456', email: context.currentUser.email } },
        context,
      ),
    ).rejects.toThrow('No OTP sent')
  })

  it('should throw error when otp is expired', async () => {
    await User.query()
      .patch({
        otpHash: validOtpHash,
        otpSentAt: new Date(Date.now() - 15 * 60 * 1000 - 1),
      })
      .where({ email: context.currentUser.email })
    await expect(
      verifyOtp(
        null,
        { input: { otp: '123456', email: context.currentUser.email } },
        context,
      ),
    ).rejects.toThrow('OTP expired')
  })

  it('should throw error when otp attempts exceeded and should not increment otp attempts', async () => {
    await User.query()
      .patch({
        otpAttempts: 5,
        otpSentAt: new Date(),
        otpHash: validOtpHash,
      })
      .where({
        email: context.currentUser.email,
      })

    await expect(
      verifyOtp(
        null,
        { input: { otp: 'incorrect-otp', email: context.currentUser.email } },
        context,
      ),
    ).rejects.toThrow('OTP attempts exceeded')

    const user = await User.query().findOne({
      email: context.currentUser.email,
    })
    expect(user?.otpAttempts).toBe(5) // should not have incremented
  })

  it('should increment otp attempts if otp attempts not exceeded', async () => {
    await User.query()
      .patch({ otpHash: validOtpHash, otpSentAt: new Date() })
      .where({ email: context.currentUser.email })

    await expect(
      verifyOtp(
        null,
        { input: { otp: 'invalid-otp', email: context.currentUser.email } },
        context,
      ),
    ).rejects.toThrow('Invalid OTP')

    const user = await User.query().findOne({
      email: context.currentUser.email,
    })
    expect(user?.otpAttempts).toBe(1)

    expect(mocks.sendOnboardingEmail).not.toHaveBeenCalled()
    expect(mocks.setAuthCookie).not.toHaveBeenCalled()
  })

  it('should reset otp attempts, send onboarding email and set auth cookie for valid otp', async () => {
    await User.query()
      .patch({ otpHash: validOtpHash, otpSentAt: new Date() })
      .where({ email: context.currentUser.email })

    await verifyOtp(
      null,
      { input: { otp: TEST_OTP, email: context.currentUser.email } },
      context,
    )

    const user = await User.query().findOne({
      email: context.currentUser.email,
    })
    expect(user?.otpAttempts).toBe(0)
    expect(mocks.sendOnboardingEmail).toHaveBeenCalled()
    expect(mocks.setAuthCookie).toHaveBeenCalledWith(context.res, {
      userId: user?.id,
    })
  })
})
