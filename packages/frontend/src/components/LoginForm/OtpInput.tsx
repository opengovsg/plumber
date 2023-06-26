import { Dispatch, SetStateAction } from 'react'
import { FormControl, FormLabel, Input } from '@chakra-ui/react'
import { Button } from '@opengovsg/design-system-react'

interface Props {
  isLoading: boolean
  email: string
  otp: string
  setOtp: Dispatch<SetStateAction<string>>
}

const OtpInput = ({ isLoading, email, otp, setOtp }: Props): JSX.Element => {
  return (
    <>
      <FormControl isRequired isReadOnly={isLoading}>
        <FormLabel requiredIndicator={<></>}>
          Enter OTP sent to {email}
        </FormLabel>
        <Input
          autoFocus
          type="text"
          autoCapitalize="true"
          autoCorrect="false"
          autoComplete="one-time-code"
          placeholder="ABC123"
          value={otp}
          onChange={(e) => {
            setOtp(e.target.value?.toUpperCase())
          }}
        />
      </FormControl>
      <Button type="submit" width="full" isLoading={isLoading}>
        Verify OTP
      </Button>
    </>
  )
}

export default OtpInput
