import { useCallback, useState } from 'react'
import { FormattedMessage } from 'react-intl'
import {
  Box as ChakraBox,
  BoxProps as ChakraBoxProps,
  Icon,
} from '@chakra-ui/react'
import AccountCircleIcon from '@mui/icons-material/AccountCircle'
import { Box, useMediaQuery } from '@mui/material'
import MuiAppBar from '@mui/material/AppBar'
import IconButton from '@mui/material/IconButton'
import Toolbar from '@mui/material/Toolbar'
import Typography from '@mui/material/Typography'
import { Link } from '@opengovsg/design-system-react'
import mainLogo from 'assets/logo.svg'
import AccountDropdownMenu from 'components/AccountDropdownMenu'
import NewsDrawer from 'components/NewsDrawer'
import { TEST_ITEM_LIST } from 'components/NewsDrawer/TestItemList'
import * as URLS from 'config/urls'
import theme from 'styles/theme'

import { Link as RouterLink } from './style'

type AppBarProps = {
  drawerOpen: boolean
  onDrawerOpen: () => void
  onDrawerClose: () => void
  maxWidth?: ChakraBoxProps['maxW']
}

const accountMenuId = 'account-menu'

// this fetches the latest time from the news
const latestNewsTimestamp =
  TEST_ITEM_LIST.length > 0 ? TEST_ITEM_LIST[0].date.getTime().toString() : ''

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

  // check whether user has read and closed the news drawer
  const [localLatestTimestamp, setLocalLatestTimestamp] = useState(
    localStorage.getItem('news-tab-latest-timestamp'),
  )

  const handleOpen = useCallback(() => {
    // only way to update this is to change the news or clear the local storage
    localStorage.setItem('news-tab-latest-timestamp', latestNewsTimestamp)
    setLocalLatestTimestamp(latestNewsTimestamp)
  }, [latestNewsTimestamp])

  return (
    <MuiAppBar
      color="transparent"
      position={drawerOpen && matchSmallScreens ? 'fixed' : 'relative'}
      sx={{ zIndex: 1 }}
    >
      <ChakraBox maxW={maxWidth}>
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
            <RouterLink to={URLS.DASHBOARD}>
              <Typography
                variant="h5"
                component="h2"
                fontFamily={'Space Grotesk'}
                noWrap
                fontWeight="bold"
              >
                <FormattedMessage id="brandText" />
              </Typography>
            </RouterLink>
          </div>

          <Link
            href={URLS.GUIDE_LINK}
            colorScheme="secondary"
            target="_blank"
            variant="link"
            mr={4}
          >
            Guide
          </Link>

          <NewsDrawer handleOpen={handleOpen}></NewsDrawer>

          {localLatestTimestamp !== latestNewsTimestamp && (
            <Icon
              boxSize={2}
              ml="-1.2rem"
              mb="0.8rem"
              mr="0.5rem"
              viewBox="0 0 200 200"
              color="red.500"
            >
              <path
                fill="currentColor"
                d="M 100, 100 m -75, 0 a 75,75 0 1,0 150,0 a 75,75 0 1,0 -150,0"
              />
            </Icon>
          )}

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
