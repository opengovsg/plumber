import { customAlphabet } from 'nanoid/async'

import appConfig from '@/config/app'
import BaseError from '@/errors/base'
import { getOrCreateUser } from '@/helpers/auth'
import { validateAndParseEmail } from '@/helpers/email-validator'
import { sendEmail } from '@/helpers/send-email'

import type { MutationResolvers } from '../__generated__/types.generated'

const OTP_LENGTH = 6
const OTP_ALLOWED_CHARS = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'
const generateOtpAsync = customAlphabet(OTP_ALLOWED_CHARS, OTP_LENGTH)

// 30 seconds in milliseconds
const OTP_RESEND_TIMEOUT_IN_MS = 1 * 30 * 1000
// 15 minutes in milliseconds
const OTP_VALIDITY_IN_MS = 15 * 60 * 1000

const requestOtp: MutationResolvers['requestOtp'] = async (_parent, params) => {
  const email = await validateAndParseEmail(params.input.email)
  // validate email
  if (!email) {
    throw new BaseError('Email is invalid or not whitelisted.')
  }
  const user = await getOrCreateUser(email)
  if (
    user.otpSentAt &&
    Date.now() - user.otpSentAt.getTime() < OTP_RESEND_TIMEOUT_IN_MS
  ) {
    throw new BaseError(
      `Please wait ${Math.floor(
        (OTP_RESEND_TIMEOUT_IN_MS - Date.now() + user.otpSentAt.getTime()) /
          1000,
      )} seconds before requesting a new OTP`,
    )
  }
  const otp = await generateOtpAsync()
  await user.$query().patch({
    otpHash: user.hashOtp(otp),
    otpAttempts: 0,
    otpSentAt: new Date(),
  })

  if (appConfig.isDev) {
    // eslint-disable-next-line no-console
    console.log(`OTP for ${email}: \x1b[45m${otp}\x1b[0m`)
  } else {
    // Send otp
    await sendEmail({
      subject: 'Your OTP for Plumber',
      body: `Your OTP is ${otp}. It's valid for ${
        OTP_VALIDITY_IN_MS / 1000 / 60
      } minutes.`,
      recipient: email,
    })
  }
  return true
}

export default requestOtp
