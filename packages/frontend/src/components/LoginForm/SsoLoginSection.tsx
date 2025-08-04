import { useCallback, useState } from 'react'
import { Flex, Text } from '@chakra-ui/react'
import { Button, Infobox } from '@opengovsg/design-system-react'

import { generateSsoAuthUrl } from '@/helpers/sso'

export default function SsoLoginSection(): JSX.Element {
  const [isRedirecting, setIsRedirecting] = useState(false)
  const [hasError, setHasError] = useState(false)

  const handleSsoLogin = useCallback(
    async () => {
      setIsRedirecting(true)
      try {
        const { url, verifier, nonce } = await generateSsoAuthUrl()
        sessionStorage.setItem('sso-verifier', verifier)
        sessionStorage.setItem('sso-nonce', nonce)
        location.assign(url)
      } catch {
        setHasError(true)
      }
    },
    // Empty dep list as this is expected to be one-shot.
    [],
  )

  return (
    <Flex flexDir="column" alignItems="center">
      <Button
        // isFullWidth a bit ugly
        width="full"
        variant="outline"
        mb={2}
        onClick={handleSsoLogin}
        isLoading={isRedirecting}
      >
        Log in with OGP SSO
      </Button>
      {hasError && (
        <Infobox variant="error" mb={2}>
          There was a problem generating encryption parameters; please contact
          support@plumber.gov.sg for help.
        </Infobox>
      )}
      <Text textStyle="body-2">For OGP officers only</Text>
    </Flex>
  )
}
