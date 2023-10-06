import { useState } from 'react'
import {
  Box as ChakraBox,
  BoxProps as ChakraBoxProps,
  Text,
} from '@chakra-ui/react'
import AccountCircleIcon from '@mui/icons-material/AccountCircle'
import { Box, useMediaQuery } from '@mui/material'
import MuiAppBar from '@mui/material/AppBar'
import IconButton from '@mui/material/IconButton'
import Toolbar from '@mui/material/Toolbar'
import { Button, Link } from '@opengovsg/design-system-react'
import mainLogo from 'assets/logo.svg'
import AccountDropdownMenu from 'components/AccountDropdownMenu'
import NewsDrawer from 'components/NewsDrawer'
import * as URLS from 'config/urls'
import theme from 'styles/theme'

type AppBarProps = {
  drawerOpen: boolean
  onDrawerOpen: () => void
  onDrawerClose: () => void
  maxWidth?: ChakraBoxProps['maxW']
}

const accountMenuId = 'account-menu'

export default function AppBar(props: AppBarProps): React.ReactElement {
  const { drawerOpen, onDrawerOpen, onDrawerClose, maxWidth = 'full' } = props
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
      sx={{ zIndex: 11 }}
    >
      <ChakraBox maxW={maxWidth}>
        <Toolbar>
          <div style={{ flexGrow: 1 }}>
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
          </div>

          <Button
            as={Link}
            href={URLS.STATUS_LINK}
            colorScheme="secondary"
            target="_blank"
            variant="link"
            mr={6}
            _hover={{ textDecoration: 'underline' }}
          >
            <Text textStyle="subhead-1">Status</Text>
          </Button>

          <Button
            as={Link}
            href={URLS.GUIDE_LINK}
            colorScheme="secondary"
            target="_blank"
            variant="link"
            mr={6}
            _hover={{ textDecoration: 'underline' }}
          >
            <Text textStyle="subhead-1">Guide</Text>
          </Button>

          <NewsDrawer />

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
      </ChakraBox>
      <AccountDropdownMenu
        anchorEl={accountMenuAnchorElement}
        id={accountMenuId}
        open={isMenuOpen}
        onClose={handleAccountMenuClose}
      />
    </MuiAppBar>
  )
}
