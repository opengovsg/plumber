import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation } from '@apollo/client'
import { LoadingButton } from '@mui/lab'
import { Stack, TextField } from '@mui/material'
import * as URLS from 'config/urls'
import { REQUEST_OTP } from 'graphql/mutations/request-otp'
import { VERIFY_OTP } from 'graphql/mutations/verify-otp'
import useAuthentication from 'hooks/useAuthentication'

export const LoginForm = (): JSX.Element => {
  const navigate = useNavigate()
  const authentication = useAuthentication()
  const [requestOtp, { loading: isRequestingOtp }] = useMutation(REQUEST_OTP)
  const [verifyOtp, { loading: isVerifyingOtp }] = useMutation(VERIFY_OTP)

  const [isOtpSent, setIsOtpSent] = useState(false)
  const [email, setEmail] = useState('')
  const [otp, setOtp] = useState('')

  useEffect(() => {
    if (authentication.isAuthenticated) {
      navigate(URLS.DASHBOARD)
    }
  }, [authentication.isAuthenticated])

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

  return (
    <form noValidate onSubmit={handleSubmit}>
      <Stack spacing={2}>
        {isOtpSent ? (
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
        ) : (
          <TextField
            fullWidth
            type="email"
            label="Email address"
            autoComplete="email"
            autoFocus
            value={email}
            required
            onChange={(e) => {
              setEmail(e.target.value)
            }}
            placeholder="user@agency.gov.sg"
          />
        )}
        <LoadingButton
          variant="contained"
          loading={isVerifyingOtp || isRequestingOtp}
          type="submit"
        >
          {isOtpSent ? 'Verify OTP' : 'Login'}
        </LoadingButton>
      </Stack>
    </form>
  )
}

export default LoginForm
