import { useContext, useMemo, useState } from 'react'
import { BiHistory, BiSolidGrid } from 'react-icons/bi'
import { HiOutlineSquare3Stack3D } from 'react-icons/hi2'
import { Navigate } from 'react-router-dom'
import { Box, Divider, Show } from '@chakra-ui/react'
import { RestrictedGovtMasthead } from '@opengovsg/design-system-react'
import AppBar from 'components/AppBar'
import { PipeIcon } from 'components/Icons'
import SiteWideBanner from 'components/SiteWideBanner'
import { TILES_FEATURE_FLAG } from 'config/flags'
import * as URLS from 'config/urls'
import { LaunchDarklyContext } from 'contexts/LaunchDarkly'
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
  // Optional LaunchDarkly flag key to control visibility of link
  ldFlagKey?: string
}

const drawerLinks = [
  {
    Icon: PipeIcon,
    text: 'Pipes',
    to: URLS.FLOWS,
  },
  {
    Icon: HiOutlineSquare3Stack3D,
    text: 'Tiles',
    to: URLS.TILES,
    ldFlagKey: TILES_FEATURE_FLAG,
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
  const { flags } = useContext(LaunchDarklyContext)

  const [isDrawerOpen, setDrawerOpen] = useState(false)

  const openDrawer = () => setDrawerOpen(true)
  const closeDrawer = () => setDrawerOpen(false)

  const layoutNavigationProviderData = useMemo(() => {
    // dont show all drawer links while flags are loading
    const filteredLinks = flags
      ? drawerLinks.filter((link) => {
          // If flag is removed, default to show tab
          if (!link.ldFlagKey) {
            return true
          }
          return flags[link.ldFlagKey] !== false
        })
      : []
    return {
      links: filteredLinks,
      isDrawerOpen,
      openDrawer,
      closeDrawer,
    } as LayoutNavigationProviderData
  }, [flags, isDrawerOpen])

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
          <Box sx={{ flex: 1, overflowX: 'hidden' }}>{children}</Box>
        </Box>
      </LayoutNavigationProvider>
    </>
  )
}
