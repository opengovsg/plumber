import { useState } from 'react'
import { useMutation } from '@apollo/client'
import { LoadingButton } from '@mui/lab'
import { Stack, TextField } from '@mui/material'
import { REQUEST_OTP } from 'graphql/mutations/request-otp'
import { VERIFY_OTP } from 'graphql/mutations/verify-otp'
import useAuthentication from 'hooks/useAuthentication'

import EmailInput from './EmailInput'

export const LoginForm = (): JSX.Element => {
  const authentication = useAuthentication()
  const [requestOtp, { loading: isRequestingOtp }] = useMutation(REQUEST_OTP)
  const [verifyOtp, { loading: isVerifyingOtp }] = useMutation(VERIFY_OTP)

  const [isOtpSent, setIsOtpSent] = useState(false)
  const [email, setEmail] = useState('')
  const [otp, setOtp] = useState('')

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
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
      const { data } = await verifyOtp({
        variables: {
          input: {
            email,
            otp,
          },
        },
      })

      const { token } = data.verifyOtp

      authentication.updateToken(token)
    }
  }

  // FIXME (ogp-weeloong): Fully migrate to starter kit style login page.
  return (
    <form noValidate onSubmit={handleSubmit}>
      <Stack spacing={2}>
        {isOtpSent ? (
          <>
            <TextField
              fullWidth
              label="OTP"
              required
              autoFocus
              value={otp}
              onChange={(e) => {
                setOtp(e.target.value)
              }}
              placeholder="123456"
            />
            <LoadingButton
              variant="contained"
              loading={isVerifyingOtp || isRequestingOtp}
              type="submit"
            >
              {isOtpSent ? 'Verify OTP' : 'Login'}
            </LoadingButton>
          </>
        ) : (
          <EmailInput
            isLoading={isRequestingOtp || isOtpSent}
            email={email}
            setEmail={setEmail}
          />
        )}
      </Stack>
    </form>
  )
}

export default LoginForm
