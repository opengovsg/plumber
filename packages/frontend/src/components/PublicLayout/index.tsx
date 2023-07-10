import { Navigate } from 'react-router-dom'
import { Flex } from '@chakra-ui/react'
import { Box } from '@mui/material'
import { RestrictedGovtMasthead } from '@opengovsg/design-system-react'
import SiteWideBanner from 'components/SiteWideBanner'
import * as URLS from 'config/urls'
import useAuthentication from 'hooks/useAuthentication'

type LayoutProps = {
  children: React.ReactNode
}

export default function Layout({ children }: LayoutProps): React.ReactElement {
  const { currentUser } = useAuthentication()
  if (currentUser) {
    return <Navigate to={URLS.DASHBOARD} />
  }

  return (
    <Flex minH="100vh" flexDir="column">
      <SiteWideBanner />
      <RestrictedGovtMasthead />
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
