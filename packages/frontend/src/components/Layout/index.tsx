import * as React from 'react'
import { BiHistory, BiSolidGrid } from 'react-icons/bi'
import { Navigate } from 'react-router-dom'
import { Box, Divider, Show } from '@chakra-ui/react'
import { RestrictedGovtMasthead } from '@opengovsg/design-system-react'
import AppBar from 'components/AppBar'
import { PipeIcon } from 'components/Icons'
import SiteWideBanner from 'components/SiteWideBanner'
import * as URLS from 'config/urls'
import {
  LayoutNavigationProvider,
  LayoutNavigationProviderData,
} from 'contexts/LayoutNavigation'
import useAuthentication from 'hooks/useAuthentication'

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

  const layoutNavigationProviderData = React.useMemo(() => {
    return {
      links: drawerLinks,
      isDrawerOpen,
      openDrawer,
      closeDrawer,
    } as LayoutNavigationProviderData
  }, [isDrawerOpen])

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
      <LayoutNavigationProvider value={layoutNavigationProviderData}>
        <Box display="flex" flex="1">
          <Show above="sm">
            <Box mt={1}>
              <NavigationSidebar />
            </Box>
            <Box>
              <Divider
                orientation="vertical"
                borderColor="base.divider.medium"
              />
            </Box>
          </Show>

          <Box sx={{ flex: 1 }}>{children}</Box>
        </Box>
      </LayoutNavigationProvider>
    </>
  )
}
