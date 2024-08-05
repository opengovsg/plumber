import { graphql } from '@/graphql/__generated__'

export const REQUEST_OTP = graphql(`
  mutation RequestOtp($input: RequestOtpInput) {
    requestOtp(input: $input)
  }
`)
