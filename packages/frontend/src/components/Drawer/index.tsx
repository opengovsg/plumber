import * as React from 'react'
import { Link, useMatch } from 'react-router-dom'
import { Text } from '@chakra-ui/react'
import Divider from '@mui/material/Divider'
import { useTheme } from '@mui/material/styles'
import { SwipeableDrawerProps } from '@mui/material/SwipeableDrawer'
import Toolbar from '@mui/material/Toolbar'
import useMediaQuery from '@mui/material/useMediaQuery'
import { SidebarContainer, SidebarItem } from '@opengovsg/design-system-react'

import { Drawer as BaseDrawer } from './style'

const iOS =
  typeof navigator !== 'undefined' &&
  /iPad|iPhone|iPod/.test(navigator.userAgent)

type DrawerLink = {
  Icon: React.ElementType
  text: string
  to: string
}

type DrawerProps = {
  links: DrawerLink[]
} & SwipeableDrawerProps

export default function Drawer(props: DrawerProps): React.ReactElement {
  const { links = [], ...drawerProps } = props
  const theme = useTheme()
  const matchSmallScreens = useMediaQuery(theme.breakpoints.down('md'), {
    noSsr: true,
  })

  const closeOnClick = (event: React.SyntheticEvent) => {
    if (matchSmallScreens) {
      props.onClose(event)
    }
  }

  const selected = (to: string) => useMatch({ path: to, end: true })

  return (
    <BaseDrawer
      {...drawerProps}
      sx={{
        position: matchSmallScreens ? 'fixed' : 'relative',
      }}
      disableDiscovery={iOS}
      variant={matchSmallScreens ? 'temporary' : 'permanent'}
    >
      {/* keep the following encapsulating `div` to have `space-between` children  */}
      <div>
        {matchSmallScreens && <Toolbar />}

        <SidebarContainer>
          {links.map(({ Icon, text, to }, index) => (
            <SidebarItem
              key={`${to}-${index}`}
              pl={6}
              icon={Icon}
              as={Link}
              to={to}
              onClick={closeOnClick}
              isActive={!!selected(to)}
              color="base.content.default"
              _hover={{
                color: 'primary.600',
                bg: 'interaction.muted.main.hover',
                borderRadius: '0',
              }}
              _active={{
                color: 'primary.600',
                bg: 'interaction.muted.main.active',
                borderRadius: '0',
              }}
            >
              <Text textStyle="subhead-1" ml={4}>
                {text}
              </Text>
            </SidebarItem>
          ))}
        </SidebarContainer>

        <Divider />
      </div>
    </BaseDrawer>
  )
}
