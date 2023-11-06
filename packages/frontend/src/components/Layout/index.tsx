import { type ElementType, useState } from 'react'
import { BiHistory, BiSolidGrid } from 'react-icons/bi'
import { Navigate } from 'react-router-dom'
import { Box, Divider, Show } from '@chakra-ui/react'
import { RestrictedGovtMasthead } from '@opengovsg/design-system-react'
import AppBar from 'components/AppBar'
import { PipeIcon } from 'components/Icons'
import NavigationDrawer from 'components/Layout/NavigationDrawer'
import SiteWideBanner from 'components/SiteWideBanner'
import * as URLS from 'config/urls'
import useAuthentication from 'hooks/useAuthentication'

import NavigationSidebar from './NavigationSidebar'

type PublicLayoutProps = {
  children: React.ReactNode
}

export type DrawerLink = {
  Icon: ElementType
  text: string
  to: string
}

const drawerLinks: DrawerLink[] = [
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

export default function Layout({ children }: PublicLayoutProps): JSX.Element {
  const { currentUser } = useAuthentication()

  const [isDrawerOpen, setDrawerOpen] = useState(false)

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
        <Show above="sm">
          <Box mt={1}>
            <NavigationSidebar links={drawerLinks} closeDrawer={closeDrawer} />
          </Box>
          <Box>
            <Divider orientation="vertical" borderColor="base.divider.medium" />
          </Box>
        </Show>
        <Show below="sm">
          <NavigationDrawer
            links={drawerLinks}
            isDrawerOpen={isDrawerOpen}
            openDrawer={openDrawer}
            closeDrawer={closeDrawer}
          />
        </Show>

        <Box sx={{ flex: 1 }}>{children}</Box>
      </Box>
    </>
  )
}
