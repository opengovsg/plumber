import crypto from 'crypto'

import BaseError from '@/errors/base'
import { BadUserInputError } from '@/errors/graphql-errors'
import { sendOnboardingEmail, setAuthCookie } from '@/helpers/auth'
import { validateAndParseEmail } from '@/helpers/email-validator'
import User from '@/models/user'

import type { MutationResolvers } from '../__generated__/types.generated'

const MAX_OTP_ATTEMPTS = 5
const MAX_OTP_INPUT_LENGTH = 64
// 15 minutes in milliseconds
const OTP_VALIDITY_IN_MS = 15 * 60 * 1000

const verifyOtp: NonNullable<MutationResolvers['verifyOtp']> = async (
  _parent,
  params,
  context,
) => {
  const { input } = params
  if (!input) {
    throw new BadUserInputError('Missing input')
  }

  const { otp, email: emailRaw } = input
  // validate email
  const email = await validateAndParseEmail(emailRaw)
  if (!email) {
    throw new BaseError('Only .gov.sg emails are allowed.')
  }
  if (!otp) {
    throw new BaseError('No OTP provided')
  }
  if (otp.length > MAX_OTP_INPUT_LENGTH) {
    throw new BaseError('Invalid OTP')
  }
  const user = await User.query().findOne({ email: email.trim().toLowerCase() })
  if (!user) {
    throw new BaseError('No such user')
  }
  const { otpHash, otpSentAt } = user
  if (!otpHash || !otpSentAt) {
    throw new BaseError('No OTP sent')
  }

  if (otpSentAt && Date.now() - otpSentAt.getTime() > OTP_VALIDITY_IN_MS) {
    throw new BaseError('OTP expired')
  }

  // check for overflow before incrementing
  if (user.otpAttempts >= MAX_OTP_ATTEMPTS) {
    throw new BaseError('OTP attempts exceeded')
  }

  // Hashed before the increment, so a full hash queue spends no attempt
  const inputOtpHash = await user.hashOtp(otp)
  // atomically increment otp retries before comparing to prevent concurrent brute force attacks
  const { otpAttempts: newOtpAttempts } = await user
    .$query()
    .increment('otp_attempts', 1)
    .returning('otp_attempts')
  if (newOtpAttempts > MAX_OTP_ATTEMPTS) {
    throw new BaseError('OTP attempts exceeded')
  }
  if (
    !crypto.timingSafeEqual(Buffer.from(otpHash), Buffer.from(inputOtpHash))
  ) {
    throw new BaseError('Invalid OTP')
  }
  await sendOnboardingEmail(user)

  // reset otp columns
  await user.$query().patch({
    otpHash: null,
    otpAttempts: 0,
    otpSentAt: null,
    lastLoginAt: new Date(),
  })
  // set auth jwt as cookie
  setAuthCookie(context.res, { userId: user.id })

  return true
}

export default verifyOtp
