import { type FormEvent, useState } from 'react'
import { useMutation } from '@apollo/client'
import { Flex } from '@chakra-ui/react'
import { REQUEST_OTP } from 'graphql/mutations/request-otp'
import { VERIFY_OTP } from 'graphql/mutations/verify-otp'
import { GET_CURRENT_USER } from 'graphql/queries/get-current-user'

import EmailInput from './EmailInput'
import OtpInput from './OtpInput'
import SgidLoginSection from './SgidLoginSection'

export const LoginForm = (): JSX.Element => {
  const [requestOtp, { loading: isRequestingOtp }] = useMutation(REQUEST_OTP)
  const [verifyOtp, { loading: isVerifyingOtp }] = useMutation(VERIFY_OTP, {
    refetchQueries: [GET_CURRENT_USER],
    awaitRefetchQueries: true,
  })

  const [isOtpSent, setIsOtpSent] = useState(false)
  const [email, setEmail] = useState('')
  const [otp, setOtp] = useState('')

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()

    if (!isOtpSent) {
      await requestOtp({
        variables: {
          input: {
            email,
          },
        },
      })
      setIsOtpSent(true)
    } else {
      await verifyOtp({
        variables: {
          input: {
            email,
            otp,
          },
        },
      })
    }
  }

  // FIXME (ogp-weeloong): Fully migrate to starter kit style login page.
  return (
    <form onSubmit={handleSubmit}>
      <Flex flexDir="column" gap={2}>
        {isOtpSent ? (
          <OtpInput
            isLoading={isVerifyingOtp}
            email={email}
            otp={otp}
            setOtp={setOtp}
          />
        ) : (
          <EmailInput
            isLoading={isRequestingOtp || isOtpSent}
            email={email}
            setEmail={setEmail}
          />
        )}

        <SgidLoginSection />
      </Flex>
    </form>
  )
}

export default LoginForm
