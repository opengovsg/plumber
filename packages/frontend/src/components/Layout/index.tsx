import * as React from 'react'
import { Navigate } from 'react-router-dom'
import AppsIcon from '@mui/icons-material/Apps'
import HistoryIcon from '@mui/icons-material/History'
import SchemaIcon from '@mui/icons-material/Schema'
import Box from '@mui/material/Box'
import { useTheme } from '@mui/material/styles'
import useMediaQuery from '@mui/material/useMediaQuery'
import AppBar from 'components/AppBar'
import Drawer from 'components/Drawer'
import { Masthead } from 'components/Masthead'
import SiteWideBanner from 'components/SiteWideBanner'
import * as URLS from 'config/urls'
import useAuthentication from 'hooks/useAuthentication'

type PublicLayoutProps = {
  children: React.ReactNode
}

const drawerLinks = [
  {
    Icon: SchemaIcon,
    primary: 'drawer.flows',
    to: URLS.FLOWS,
    dataTest: 'flows-page-drawer-link',
  },
  {
    Icon: AppsIcon,
    primary: 'drawer.apps',
    to: URLS.APPS,
    dataTest: 'apps-page-drawer-link',
  },
  {
    Icon: HistoryIcon,
    primary: 'drawer.executions',
    to: URLS.EXECUTIONS,
    dataTest: 'executions-page-drawer-link',
  },
]

export default function PublicLayout({
  children,
}: PublicLayoutProps): React.ReactElement {
  const theme = useTheme()
  const auth = useAuthentication()

  const matchSmallScreens = useMediaQuery(theme.breakpoints.down('lg'), {
    noSsr: true,
  })
  const [isDrawerOpen, setDrawerOpen] = React.useState(!matchSmallScreens)

  const openDrawer = () => setDrawerOpen(true)
  const closeDrawer = () => setDrawerOpen(false)

  if (!auth.isAuthenticated) {
    return <Navigate to={URLS.LOGIN} />
  }

  return (
    <>
      <SiteWideBanner />
      <Masthead />
      <AppBar
        drawerOpen={isDrawerOpen}
        onDrawerOpen={openDrawer}
        onDrawerClose={closeDrawer}
      />
      <Box sx={{ display: 'flex', flex: 1 }}>
        <Drawer
          links={drawerLinks}
          open={isDrawerOpen}
          onOpen={openDrawer}
          onClose={closeDrawer}
        />

        <Box sx={{ flex: 1 }}>{children}</Box>
      </Box>
    </>
  )
}
