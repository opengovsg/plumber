import * as React from 'react'
import Divider from '@mui/material/Divider'
import List from '@mui/material/List'
import { useTheme } from '@mui/material/styles'
import { SwipeableDrawerProps } from '@mui/material/SwipeableDrawer'
import Toolbar from '@mui/material/Toolbar'
import useMediaQuery from '@mui/material/useMediaQuery'
import ListItemLink from 'components/ListItemLink'
import useFormatMessage from 'hooks/useFormatMessage'

import { Drawer as BaseDrawer } from './style'

const iOS =
  typeof navigator !== 'undefined' &&
  /iPad|iPhone|iPod/.test(navigator.userAgent)

type DrawerLink = {
  Icon: React.ElementType
  primary: string
  to: string
  badgeContent?: React.ReactNode
  dataTest?: string
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
  const formatMessage = useFormatMessage()

  const closeOnClick = (event: React.SyntheticEvent) => {
    if (matchSmallScreens) {
      props.onClose(event)
    }
  }

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

        <List sx={{ py: 0, mt: 3 }}>
          {links.map(({ Icon, primary, to, dataTest }, index) => (
            <ListItemLink
              key={`${to}-${index}`}
              icon={<Icon htmlColor={theme.palette.primary.main} />}
              primary={formatMessage(primary)}
              to={to}
              onClick={closeOnClick}
              data-test={dataTest}
            />
          ))}
        </List>

        <Divider />
      </div>
    </BaseDrawer>
  )
}
