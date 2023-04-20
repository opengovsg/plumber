import * as React from 'react'
import AppsIcon from '@mui/icons-material/Apps'
import HistoryIcon from '@mui/icons-material/History'
import SchemaIcon from '@mui/icons-material/Schema'
import Box from '@mui/material/Box'
import { useTheme } from '@mui/material/styles'
import useMediaQuery from '@mui/material/useMediaQuery'
import AppBar from 'components/AppBar'
import Drawer from 'components/Drawer'
import * as URLS from 'config/urls'

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
  const matchSmallScreens = useMediaQuery(theme.breakpoints.down('lg'), {
    noSsr: true,
  })
  const [isDrawerOpen, setDrawerOpen] = React.useState(!matchSmallScreens)

  const openDrawer = () => setDrawerOpen(true)
  const closeDrawer = () => setDrawerOpen(false)

  return (
    <>
      <AppBar
        drawerOpen={isDrawerOpen}
        onDrawerOpen={openDrawer}
        onDrawerClose={closeDrawer}
      />
      <Box sx={{ display: 'flex' }}>
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
