import { gql } from '@apollo/client';

export const VERIFY_OTP = gql`
  mutation VerifyOtp($input: VerifyOtpInput) {
    verifyOtp(input: $input) {
      token
    }
  }
`;
