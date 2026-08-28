import { useCallback, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useMutation } from '@apollo/client'
import { Flex, Link, Text } from '@chakra-ui/react'
import { Button, Infobox } from '@opengovsg/design-system-react'

import { SUPPORT_FORM_LINK } from '@/config/urls'
import { START_SSO_LOGIN } from '@/graphql/mutations/start-sso-login'
import { storePostLoginRedirect } from '@/helpers/post-login-redirect'

export default function SsoLoginSection(): JSX.Element {
  const [searchParams] = useSearchParams()
  const [isRedirecting, setIsRedirecting] = useState(false)
  const [hasError, setHasError] = useState(false)
  const [startSsoLogin] = useMutation(START_SSO_LOGIN, {
    context: { autoSnackbar: false },
  })

  const handleSsoLogin = useCallback(async () => {
    setIsRedirecting(true)
    try {
      storePostLoginRedirect(searchParams.get('redirect'))
      const { data } = await startSsoLogin()
      const authorizationUrl = data?.startSsoLogin?.authorizationUrl
      if (!authorizationUrl) {
        throw new Error('Missing authorization URL')
      }
      location.assign(authorizationUrl)
    } catch {
      setHasError(true)
      setIsRedirecting(false)
    }
  }, [searchParams, startSsoLogin])

  return (
    <Flex flexDir="column" alignItems="center">
      <Button
        width="full"
        variant="outline"
        mb={2}
        onClick={handleSsoLogin}
        isLoading={isRedirecting}
      >
        Log in with one.gov.sg
      </Button>
      {hasError && (
        <Infobox variant="error" mb={2}>
          There was a problem starting SSO; please visit our{' '}
          <Link href={SUPPORT_FORM_LINK} isExternal>
            support form
          </Link>{' '}
          for help.
        </Infobox>
      )}
      <Text textStyle="body-2">For government officers</Text>
    </Flex>
  )
}
