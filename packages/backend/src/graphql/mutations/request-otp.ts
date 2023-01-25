import crypto from 'crypto';
import User from '../../models/user';
import validator from 'email-validator';
import { sendEmail } from '../../helpers/send-email';

type Params = {
  input: {
    email: string;
  };
};

// 5 minutes in milliseconds
const OTP_RESEND_TIMEOUT_IN_MS = 5 * 60 * 1000;
// 15 minutes in milliseconds
const OTP_VALIDITY_IN_MS = 15 * 60 * 1000;

const requestOtp = async (
  _parent: unknown,
  params: Params
): Promise<boolean> => {
  const email = params.input.email.toLowerCase().trim();
  // validate email
  if (!validator.validate(email) || !email.endsWith('.gov.sg')) {
    throw new Error('Only .gov.sg emails are allowed.');
  }
  // check if user exists
  let user = await User.query().findOne({ email });
  if (!user) {
    user = await User.query().insertAndFetch({ email });
  }
  if (
    user.otpSentAt &&
    Date.now() - user.otpSentAt.getTime() < OTP_RESEND_TIMEOUT_IN_MS
  ) {
    throw new Error(
      `Please wait ${Math.floor(
        (OTP_RESEND_TIMEOUT_IN_MS - Date.now() + user.otpSentAt.getTime()) /
          1000
      )} seconds before requesting a new OTP`
    );
  }
  const otp = crypto.randomInt(0, 1000000).toString().padStart(6, '0');
  await user.$query().patch({
    otpHash: user.hashOtp(otp),
    otpAttempts: 0,
    otpSentAt: new Date()
  });

  // Send otp
  await sendEmail({
    subject: 'Your OTP for Zap',
    body: `Your OTP is ${otp}. It's valid for ${
      OTP_VALIDITY_IN_MS / 1000 / 60
    } minutes.`,
    recipient: email
  });
  return true;
};

export default requestOtp;
