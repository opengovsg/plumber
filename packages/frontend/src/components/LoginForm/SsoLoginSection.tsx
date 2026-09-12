import { useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Flex, Text } from '@chakra-ui/react'
import { Button } from '@opengovsg/design-system-react'

import * as URLS from '@/config/urls'
import { isSafeInternalPath } from '@/helpers/post-login-redirect'

export default function SsoLoginSection(): JSX.Element {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()

  const handleSsoLogin = useCallback(() => {
    const redirect = searchParams.get('redirect')
    const params = new URLSearchParams()
    if (isSafeInternalPath(redirect)) {
      params.set('redirect', redirect)
    }
    const query = params.toString()
    navigate({
      pathname: URLS.LOGIN_SSO,
      search: query ? `?${query}` : '',
    })
  }, [navigate, searchParams])

  return (
    <Flex flexDir="column" alignItems="center">
      <Button width="full" variant="outline" mb={2} onClick={handleSsoLogin}>
        Log in with one.gov.sg
      </Button>
      <Text textStyle="body-2">For government officers</Text>
    </Flex>
  )
}
