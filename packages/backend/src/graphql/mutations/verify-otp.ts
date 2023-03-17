import crypto from 'crypto'
import jwt from 'jsonwebtoken'

import appConfig from '../../config/app'
import BaseError from '../../errors/base'
import { validateAndParseEmail } from '../../helpers/email-validator'
import User from '../../models/user'

type Params = {
  input: {
    email: string
    otp: string
  }
}

const TOKEN_EXPIRES_IN = '14d'
const MAX_OTP_ATTEMPTS = 5
// 15 minutes in milliseconds
const OTP_VALIDITY_IN_MS = 15 * 60 * 1000

const verifyOtp = async (
  _parent: unknown,
  params: Params,
): Promise<{ token: string; user: User }> => {
  const { otp, email: emailRaw } = params.input
  // validate email
  const email = validateAndParseEmail(emailRaw)
  if (!email) {
    throw new BaseError('Only .gov.sg emails are allowed.')
  }
  if (!otp) {
    throw new BaseError('No OTP provided')
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
  // atomically increment otp retries first to prevent concurrent bruce force attacks
  const { otpAttempts: newOtpAttempts } = await user
    .$query()
    .increment('otp_attempts', 1)
  if (newOtpAttempts > MAX_OTP_ATTEMPTS) {
    throw new BaseError('OTP attempts exceeded')
  }
  const inputOtpHash = user.hashOtp(otp)
  if (
    !crypto.timingSafeEqual(Buffer.from(otpHash), Buffer.from(inputOtpHash))
  ) {
    throw new BaseError('Invalid OTP')
  }
  // reset otp columns
  const updatedUser = await user.$query().patchAndFetch({
    otpHash: null,
    otpAttempts: 0,
    otpSentAt: null,
  })

  // create jwt
  const token = jwt.sign({ userId: user.id }, appConfig.appSecretKey, {
    expiresIn: TOKEN_EXPIRES_IN,
  })
  return { token, user: updatedUser }
}

export default verifyOtp
