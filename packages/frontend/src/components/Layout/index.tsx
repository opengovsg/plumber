import * as React from 'react'
import { BiHistory, BiSolidGrid } from 'react-icons/bi'
import { Navigate } from 'react-router-dom'
import { createIcon } from '@chakra-ui/react'
import Box from '@mui/material/Box'
import { useTheme } from '@mui/material/styles'
import useMediaQuery from '@mui/material/useMediaQuery'
import { RestrictedGovtMasthead } from '@opengovsg/design-system-react'
import AppBar from 'components/AppBar'
import Drawer from 'components/Drawer'
import SiteWideBanner from 'components/SiteWideBanner'
import * as URLS from 'config/urls'
import useAuthentication from 'hooks/useAuthentication'

type PublicLayoutProps = {
  children: React.ReactNode
}

// have to create icon because images don't allow to modify svg content
const PipeIcon = createIcon({
  displayName: 'PipeIcon',
  viewBox: '0 0 20 20',
  path: (
    <path
      d="M15.0704 12.4616V12.4866H15.0954L17.4858 12.4866L17.5108 12.4866V12.4616V7.83483C17.5108 5.15686 15.3294 2.975 12.651 2.975H12.6051C9.92709 2.975 7.74522 5.15644 7.74522 7.83483V11.3509C7.74522 12.682 6.65694 13.7702 5.32584 13.7702H4.49046H4.46546V13.7952V16.1856V16.2106H4.49046H5.32584C8.00381 16.2106 10.1857 14.0292 10.1857 11.3508V7.83477C10.1857 6.50368 11.274 5.41539 12.6051 5.41539H12.651C13.9821 5.41539 15.0704 6.50368 15.0704 7.83477V12.4616ZM17.9151 12.9219H14.6666C14.4406 12.9219 14.2562 13.1064 14.2562 13.3323V14.5661C14.2562 14.7921 14.4407 14.9765 14.6666 14.9765H17.9151C18.1411 14.9765 18.3255 14.792 18.3255 14.5661V13.3323C18.3255 13.1068 18.141 12.9219 17.9151 12.9219ZM4.02961 16.6146V13.3661C4.02961 13.1406 3.84512 12.9557 3.61922 12.9557H2.38539C2.1594 12.9557 1.975 13.1403 1.975 13.3661V16.6146C1.975 16.8401 2.15949 17.025 2.38539 17.025H3.61922C3.84472 17.025 4.02961 16.8405 4.02961 16.6146Z"
      fill="currentColor"
      stroke="currentColor"
      stroke-width="0.05"
    />
  ),
})

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

        <Box sx={{ flex: 1 }}>{children}</Box>
      </Box>
    </>
  )
}
