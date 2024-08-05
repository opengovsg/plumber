import { graphql } from '@/graphql/__generated__'

export const VERIFY_OTP = graphql(`
  mutation VerifyOtp($input: VerifyOtpInput) {
    verifyOtp(input: $input)
  }
`)
