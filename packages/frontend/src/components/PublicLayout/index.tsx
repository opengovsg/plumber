import { Helmet } from 'react-helmet'
import { Navigate } from 'react-router-dom'
import { Box, Flex } from '@chakra-ui/react'
import { RestrictedGovtMasthead } from '@opengovsg/design-system-react'

import SiteWideBanner from '@/components/SiteWideBanner'
import * as URLS from '@/config/urls'
import useAuthentication from '@/hooks/useAuthentication'

type LayoutProps = {
  children: React.ReactNode
}

export default function Layout({ children }: LayoutProps): React.ReactElement {
  const { currentUser } = useAuthentication()
  if (currentUser) {
    const urlParams = new URLSearchParams(window.location.search)
    const queryRedirect = urlParams.get('redirect')
    const state = urlParams.get('state')
    const stateRedirect = state?.startsWith('/') ? state : null
    const storedRedirect = sessionStorage.getItem('sso-post-login-redirect')
    if (storedRedirect) {
      sessionStorage.removeItem('sso-post-login-redirect')
    }
    const redirectUrl = queryRedirect ?? stateRedirect ?? storedRedirect
    const isSafeRedirect =
      typeof redirectUrl === 'string' &&
      redirectUrl.startsWith('/') &&
      !redirectUrl.startsWith('//')
    return <Navigate to={isSafeRedirect ? redirectUrl : URLS.DASHBOARD} />
  }

  return (
    <Flex minH="100vh" flexDir="column">
      <SiteWideBanner />
      <RestrictedGovtMasthead />
      <Helmet>
        <title>Plumber</title>
      </Helmet>
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          flex: 1,
          alignItems: 'stretch',
        }}
      >
        {children}
      </Box>
    </Flex>
  )
}
