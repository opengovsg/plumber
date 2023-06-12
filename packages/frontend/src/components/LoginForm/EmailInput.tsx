import { Dispatch, SetStateAction } from 'react'
import { FormControl, FormLabel, Input } from '@chakra-ui/react'
import { Button } from '@opengovsg/design-system-react'

interface EmailInputProps {
  isLoading: boolean
  email: string
  setEmail: Dispatch<SetStateAction<string>>
}

const EmailInput = ({
  isLoading,
  email,
  setEmail,
}: EmailInputProps): JSX.Element => {
  return (
    <>
      <FormControl id="email" isRequired isReadOnly={isLoading}>
        <FormLabel requiredIndicator={<></>}>
          Log in with a .gov.sg or other whitelisted email address
        </FormLabel>
        <Input
          autoFocus
          type="email"
          placeholder="e.g. user@agency.gov.sg"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value)
          }}
        />
      </FormControl>
      <Button type="submit" isLoading={isLoading}>
        Get OTP
      </Button>
    </>
  )
}

export default EmailInput
