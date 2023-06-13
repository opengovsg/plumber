import { useState } from 'react'
import { FormattedMessage } from 'react-intl'
import AccountCircleIcon from '@mui/icons-material/AccountCircle'
import { Box, useMediaQuery } from '@mui/material'
import MuiAppBar from '@mui/material/AppBar'
import type { ContainerProps } from '@mui/material/Container'
import IconButton from '@mui/material/IconButton'
import Toolbar from '@mui/material/Toolbar'
import Typography from '@mui/material/Typography'
import { Button } from '@opengovsg/design-system-react'
import mainLogo from 'assets/logo.svg'
import AccountDropdownMenu from 'components/AccountDropdownMenu'
import Container from 'components/Container'
import * as URLS from 'config/urls'
import theme from 'styles/theme'

import { Link } from './style'

type AppBarProps = {
  drawerOpen: boolean
  onDrawerOpen: () => void
  onDrawerClose: () => void
  maxWidth?: ContainerProps['maxWidth']
}

const accountMenuId = 'account-menu'

export default function AppBar(props: AppBarProps): React.ReactElement {
  const { drawerOpen, onDrawerOpen, onDrawerClose, maxWidth = false } = props
  const matchSmallScreens = useMediaQuery(theme.breakpoints.down('md'), {
    noSsr: true,
  })
  const [accountMenuAnchorElement, setAccountMenuAnchorElement] =
    useState<null | HTMLElement>(null)

  const isMenuOpen = Boolean(accountMenuAnchorElement)

  const handleAccountMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAccountMenuAnchorElement(event.currentTarget)
  }

  const handleAccountMenuClose = () => {
    setAccountMenuAnchorElement(null)
  }

  return (
    <MuiAppBar
      color="transparent"
      position={drawerOpen && matchSmallScreens ? 'fixed' : 'relative'}
    >
      <Container maxWidth={maxWidth} disableGutters>
        <Toolbar>
          <IconButton
            size="large"
            edge="start"
            color="inherit"
            aria-label="open drawer"
            onClick={drawerOpen ? onDrawerClose : onDrawerOpen}
            disableRipple
          >
            <Box component="img" src={mainLogo} height="80%" width="80%" />
          </IconButton>

          <div style={{ flexGrow: 1 }}>
            <Link to={URLS.DASHBOARD}>
              <Typography
                variant="h5"
                component="h2"
                fontFamily={'Space Grotesk'}
                noWrap
                fontWeight="bold"
              >
                <FormattedMessage id="brandText" />
              </Typography>
            </Link>
          </div>

          <Button
            variant="link"
            onClick={() => window.open(URLS.GUIDE_LINK, '_blank')}
            textDecoration="none"
            colorScheme="secondary"
            mr={4}
          >
            Guide
          </Button>

          <IconButton
            size="large"
            edge="start"
            color="inherit"
            onClick={handleAccountMenuOpen}
            aria-controls={accountMenuId}
            aria-label="open profile menu"
            data-test="profile-menu-button"
          >
            <AccountCircleIcon />
          </IconButton>
        </Toolbar>
      </Container>

      <AccountDropdownMenu
        anchorEl={accountMenuAnchorElement}
        id={accountMenuId}
        open={isMenuOpen}
        onClose={handleAccountMenuClose}
      />
    </MuiAppBar>
  )
}
