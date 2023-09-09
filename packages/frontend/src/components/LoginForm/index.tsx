import { type FormEvent, useCallback, useState } from 'react'
import { useMutation } from '@apollo/client'
import {
  AbsoluteCenter,
  Box,
  Divider,
  Flex,
  Link,
  Text,
} from '@chakra-ui/react'
import { Button } from '@opengovsg/design-system-react'
import { REQUEST_OTP } from 'graphql/mutations/request-otp'
import { VERIFY_OTP } from 'graphql/mutations/verify-otp'
import { GET_CURRENT_USER } from 'graphql/queries/get-current-user'
import { buildSgidAuthCodeUrl, SGID_CHECK_ELIGIBILITY_URL } from 'helpers/sgid'

import EmailInput from './EmailInput'
import OtpInput from './OtpInput'

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

  const handleSgidLogin = useCallback(async () => {
    const { url, verifier, nonce } = await buildSgidAuthCodeUrl()
    sessionStorage.setItem('sgid-verifier', verifier)
    sessionStorage.setItem('sgid-nonce', nonce)
    location.assign(url)
  }, [])

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

        <Box position="relative" my="2.5rem">
          <Divider />
          <AbsoluteCenter>
            <Box bg="white" p={3}>
              <Text textStyle="subhead-1">or</Text>
            </Box>
          </AbsoluteCenter>
        </Box>

        <Flex flexDir="column" alignItems="center">
          {/* isFullWidth a bit ugly */}
          <Button width="full" mb={2} onClick={handleSgidLogin}>
            Log in with SingPass
          </Button>
          <Text>
            Can my agency use this? Check{' '}
            <Link target="_blank" href={SGID_CHECK_ELIGIBILITY_URL}>
              here.
            </Link>
          </Text>
        </Flex>
      </Flex>
    </form>
  )
}

export default LoginForm
