import { Helmet } from 'react-helmet'
import { Navigate } from 'react-router-dom'
import { Box, Flex } from '@chakra-ui/react'
import { RestrictedGovtMasthead } from '@opengovsg/design-system-react'

import SiteWideBanner from '@/components/SiteWideBanner'
import * as URLS from '@/config/urls'
import {
  consumePostLoginRedirect,
  isSafeInternalPath,
} from '@/helpers/post-login-redirect'
import useAuthentication from '@/hooks/useAuthentication'

type LayoutProps = {
  children: React.ReactNode
}

export default function Layout({ children }: LayoutProps): React.ReactElement {
  const { currentUser } = useAuthentication()
  if (currentUser) {
    const urlParams = new URLSearchParams(window.location.search)
    const queryRedirect = urlParams.get('redirect')
    const storedRedirect = consumePostLoginRedirect()
    const redirectUrl = isSafeInternalPath(queryRedirect)
      ? queryRedirect
      : storedRedirect
    return <Navigate to={redirectUrl ?? URLS.DASHBOARD} replace />
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
