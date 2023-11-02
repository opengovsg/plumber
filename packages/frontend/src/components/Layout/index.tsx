import * as React from 'react'
import { BiHistory, BiSolidGrid } from 'react-icons/bi'
import { Navigate } from 'react-router-dom'
import { Divider, Hide, Show } from '@chakra-ui/react'
import Box from '@mui/material/Box'
import { RestrictedGovtMasthead } from '@opengovsg/design-system-react'
import AppBar from 'components/AppBar'
import { PipeIcon } from 'components/Icons'
import SiteWideBanner from 'components/SiteWideBanner'
import * as URLS from 'config/urls'
import useAuthentication from 'hooks/useAuthentication'

import NavigationDrawer from './NavigationDrawer'
import NavigationSidebar from './NavigationSidebar'

type PublicLayoutProps = {
  children: React.ReactNode
}

export type DrawerLink = {
  Icon: React.ElementType
  text: string
  to: string
}

const drawerLinks = [
  {
    Icon: PipeIcon,
    text: 'Pipes',
    to: URLS.FLOWS,
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
  const { currentUser } = useAuthentication()

  const [isDrawerOpen, setDrawerOpen] = React.useState(false)

  const openDrawer = () => setDrawerOpen(true)
  const closeDrawer = () => setDrawerOpen(false)

  if (!currentUser) {
    const redirectQueryParam = window.location.pathname + window.location.search
    return (
      <Navigate
        to={URLS.ADD_REDIRECT_TO_LOGIN(encodeURIComponent(redirectQueryParam))}
      />
    )
  }

  return (
    <>
      <SiteWideBanner />
      <RestrictedGovtMasthead />
      <AppBar />
      <Box sx={{ display: 'flex', flex: 1 }}>
        <Show above="md">
          <Box mt={1}>
            <NavigationSidebar links={drawerLinks} onClose={closeDrawer} />
          </Box>
        </Show>
        <Hide above="md">
          <NavigationDrawer
            isOpen={isDrawerOpen}
            onOpen={openDrawer}
            onClose={closeDrawer}
            links={drawerLinks}
          />
        </Hide>

        <Box>
          <Divider orientation="vertical" borderColor="base.divider.medium" />
        </Box>

        <Box sx={{ flex: 1 }}>{children}</Box>
      </Box>
    </>
  )
}
