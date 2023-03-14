import * as React from 'react'
import AccountCircleIcon from '@mui/icons-material/AccountCircle'
import ArrowBackIosNewIcon from '@mui/icons-material/ArrowBackIosNew'
import Box from '@mui/material/Box'
import { useTheme } from '@mui/material/styles'
import useMediaQuery from '@mui/material/useMediaQuery'
import AppBar from 'components/AppBar'
import Drawer from 'components/Drawer'
import * as URLS from 'config/urls'

type SettingsLayoutProps = {
  children: React.ReactNode
}

const drawerLinks = [
  {
    Icon: AccountCircleIcon,
    primary: 'settingsDrawer.myProfile',
    to: URLS.SETTINGS_PROFILE,
  },
]

const drawerBottomLinks = [
  {
    Icon: ArrowBackIosNewIcon,
    primary: 'settingsDrawer.goBack',
    to: '/',
  },
]

export default function SettingsLayout({
  children,
}: SettingsLayoutProps): React.ReactElement {
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
          bottomLinks={drawerBottomLinks}
          open={isDrawerOpen}
          onOpen={openDrawer}
          onClose={closeDrawer}
        />

        <Box sx={{ flex: 1 }}>{children}</Box>
      </Box>
    </>
  )
}
