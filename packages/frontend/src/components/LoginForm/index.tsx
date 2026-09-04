import { useMutation } from '@apollo/client'
import { AbsoluteCenter, Box, Divider, Flex, Text } from '@chakra-ui/react'
import { type FormEvent, useContext, useState } from 'react'

import appConfig from '@/config/app'
import { SGID_FEATURE_FLAG, SSO_FEATURE_FLAG } from '@/config/flags'
import { RESPONSE_HEADERS } from '@/config/headers'
import { LaunchDarklyContext } from '@/contexts/LaunchDarkly'
import { REQUEST_OTP } from '@/graphql/mutations/request-otp'
import { VERIFY_OTP } from '@/graphql/mutations/verify-otp'
import { GET_CURRENT_USER } from '@/graphql/queries/get-current-user'
import { useResponseHeaders } from '@/hooks/useResponseHeaders'

import EmailInput from './EmailInput'
import OtpInput from './OtpInput'
import SgidLoginSection from './SgidLoginSection'
import SsoLoginSection from './SsoLoginSection'

export const LoginForm = (): JSX.Element => {
  const { getFlagValue } = useContext(LaunchDarklyContext)

  const headers = useResponseHeaders()

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

  const shouldShowSgidLogin = getFlagValue(SGID_FEATURE_FLAG, false)
  // show sso login if request is from OGP office wifi or in dev
  const shouldShowSsoLogin =
    (headers[RESPONSE_HEADERS.OGP_INTERNAL_HEADER] === 'true' ||
      appConfig.isDev) &&
    getFlagValue(SSO_FEATURE_FLAG, false)

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
        {(shouldShowSgidLogin || shouldShowSsoLogin) && (
          <>
            <Box position="relative" my="2.5rem">
              <Divider />
              <AbsoluteCenter>
                <Box bg="white" p={3}>
                  <Text textStyle="subhead-1">OR</Text>
                </Box>
              </AbsoluteCenter>
            </Box>
            <Flex flexDir="column" gap={8}>
              {shouldShowSgidLogin && <SgidLoginSection />}
              {shouldShowSsoLogin && <SsoLoginSection />}
            </Flex>
          </>
        )}
      </Flex>
    </form>
  )
}

export default LoginForm
