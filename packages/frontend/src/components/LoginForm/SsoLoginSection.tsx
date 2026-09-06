import { useCallback, useState } from 'react'
import { Flex, Image, Text } from '@chakra-ui/react'
import { Button } from '@opengovsg/design-system-react'

import oneGovSgLogo from '@/assets/one-gov-sg-logo.png'
import * as URLS from '@/config/urls'

export default function SsoLoginSection(): JSX.Element {
  const [isRedirecting, setIsRedirecting] = useState(false)

  const handleSsoLogin = useCallback(() => {
    setIsRedirecting(true)
    location.assign(URLS.LOGIN_SSO)
  }, [])

  return (
    <Flex flexDir="column" alignItems="center">
      <Button
        width="full"
        variant="outline"
        mb={2}
        onClick={handleSsoLogin}
        isLoading={isRedirecting}
      >
        Log in with{' '}
        <Image
          src={oneGovSgLogo}
          alt="one.gov.sg"
          h="20px"
          w="63px"
          ml={1}
          objectFit="contain"
        />
      </Button>
      <Text textStyle="body-2">For OGP officers only</Text>
    </Flex>
  )
}
