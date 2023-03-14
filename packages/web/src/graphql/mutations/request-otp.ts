import { gql } from '@apollo/client'

export const REQUEST_OTP = gql`
  mutation RequestOtp($input: RequestOtpInput) {
    requestOtp(input: $input)
  }
`
