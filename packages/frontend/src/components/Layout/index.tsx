import { useMemo, useState } from 'react'
import { Helmet } from 'react-helmet'
import {
  BiBookOpen,
  BiBookReader,
  BiHistory,
  BiSolidGrid,
  BiTable,
} from 'react-icons/bi'
import { Box, Divider, Show } from '@chakra-ui/react'

import AppBar from '@/components/AppBar'
import { PipeIcon } from '@/components/Icons'
import RedirectToLogin from '@/components/RedirectToLogin'
import SiteWideBanner from '@/components/SiteWideBanner'
import * as URLS from '@/config/urls'
import {
  LayoutNavigationProvider,
  LayoutNavigationProviderData,
} from '@/contexts/LayoutNavigation'
import useAuthentication from '@/hooks/useAuthentication'

import NavigationSidebar from './NavigationSidebar'

type PublicLayoutProps = {
  children: React.ReactNode
}

export type DrawerLink = {
  Icon: React.ElementType
  text: string
  to: string
  otherLinks?: string[]
  isBottom?: boolean
  badge?: string
  isExternal?: boolean
}

const drawerLinks = [
  {
    Icon: PipeIcon,
    text: 'Pipes',
    to: URLS.FLOWS,
  },
  {
    Icon: BiTable,
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
    otherLinks: [URLS.EXECUTIONS_FOR_FLOW_PATTERN, URLS.EXECUTION_PATTERN],
  },
  {
    Icon: BiBookOpen,
    text: 'Templates',
    to: URLS.TEMPLATES,
    isBottom: true,
  },
  {
    Icon: BiBookReader,
    text: 'Learn',
    to: URLS.LEARN_LINK,
    isBottom: true,
    badge: 'New',
    isExternal: true,
  },
]

export default function Layout({ children }: PublicLayoutProps): JSX.Element {
  const { currentUser } = useAuthentication()

  const [isDrawerOpen, setDrawerOpen] = useState(false)

  const openDrawer = () => setDrawerOpen(true)
  const closeDrawer = () => setDrawerOpen(false)

  const layoutNavigationProviderData = useMemo(() => {
    return {
      links: drawerLinks,
      isDrawerOpen,
      openDrawer,
      closeDrawer,
    } as LayoutNavigationProviderData
  }, [isDrawerOpen])

  if (!currentUser) {
    return <RedirectToLogin />
  }

  return (
    <>
      <SiteWideBanner />
      <Helmet>
        <title>Plumber</title>
      </Helmet>
      <LayoutNavigationProvider value={layoutNavigationProviderData}>
        <AppBar />
        <Box display="flex" flex="1">
          <Show above="sm">
            <NavigationSidebar />
            <Box>
              <Divider
                orientation="vertical"
                borderColor="base.divider.medium"
              />
            </Box>
          </Show>
          <Box flex={1} overflowX="hidden">
            {children}
          </Box>
        </Box>
      </LayoutNavigationProvider>
    </>
  )
}
