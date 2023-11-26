import * as React from 'react'
import { BiHistory, BiSolidGrid } from 'react-icons/bi'
import { BsTable } from 'react-icons/bs'
import { Navigate } from 'react-router-dom'
import Box from '@mui/material/Box'
import { useTheme } from '@mui/material/styles'
import useMediaQuery from '@mui/material/useMediaQuery'
import { RestrictedGovtMasthead } from '@opengovsg/design-system-react'
import AppBar from 'components/AppBar'
import Drawer from 'components/Drawer'
import { PipeIcon } from 'components/Icons'
import SiteWideBanner from 'components/SiteWideBanner'
import * as URLS from 'config/urls'
import useAuthentication from 'hooks/useAuthentication'

type PublicLayoutProps = {
  children: React.ReactNode
}

const drawerLinks = [
  {
    Icon: PipeIcon,
    text: 'Pipes',
    to: URLS.FLOWS,
  },
  {
    Icon: BsTable,
    text: 'Tiles',
    to: URLS.TILES,
  },
  {
    Icon: BiSolidGrid,
    text: 'My Apps',
    to: URLS.APPS,
  },
  {
    Icon: BiHistory,
    text: 'Executions',
    to: URLS.EXECUTIONS,
  },
]

export default function Layout({
  children,
}: PublicLayoutProps): React.ReactElement {
  const theme = useTheme()
  const { currentUser } = useAuthentication()

  const matchSmallScreens = useMediaQuery(theme.breakpoints.down('lg'), {
    noSsr: true,
  })
  const [isDrawerOpen, setDrawerOpen] = React.useState(!matchSmallScreens)

  const openDrawer = () => setDrawerOpen(true)
  const closeDrawer = () => setDrawerOpen(false)

  if (!currentUser) {
    return <Navigate to={URLS.LOGIN} />
  }

  return (
    <>
      <SiteWideBanner />
      <RestrictedGovtMasthead />
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

        <Box sx={{ flex: 1, overflowX: 'hidden' }}>{children}</Box>
      </Box>
    </>
  )
}
