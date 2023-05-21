import { Navigate } from 'react-router-dom'
import { Box } from '@mui/material'
import { Masthead } from 'components/Masthead'
import SiteWideBanner from 'components/SiteWideBanner'
import * as URLS from 'config/urls'
import useAuthentication from 'hooks/useAuthentication'

type LayoutProps = {
  children: React.ReactNode
}

export default function Layout({ children }: LayoutProps): React.ReactElement {
  const auth = useAuthentication()
  if (auth.isAuthenticated) {
    return <Navigate to={URLS.DASHBOARD} />
  }

  return (
    <>
      <SiteWideBanner />
      <Masthead />
      <Box sx={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
        {children}
      </Box>
    </>
  )
}
