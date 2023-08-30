import { drawerClasses } from '@mui/material/Drawer'
import { CSSObject, styled, Theme } from '@mui/material/styles'
import MuiSwipeableDrawer from '@mui/material/SwipeableDrawer'

const drawerWidth = 300

const openedMixin = (theme: Theme): CSSObject => ({
  transition: theme.transitions.create('width', {
    easing: theme.transitions.easing.sharp,
    duration: theme.transitions.duration.enteringScreen,
  }),
  overflowX: 'hidden',
  width: '100vw',
  [theme.breakpoints.up('sm')]: {
    width: drawerWidth,
  },
})

const closedMixin = (theme: Theme): CSSObject => ({
  transition: theme.transitions.create('width', {
    easing: theme.transitions.easing.sharp,
    duration: theme.transitions.duration.leavingScreen,
  }),
  overflowX: 'hidden',
  width: 0,
  [theme.breakpoints.up('sm')]: {
    width: `calc(${theme.spacing(9)} + 1px)`,
  },
})

export const Drawer = styled(MuiSwipeableDrawer)(({ theme, open }) => ({
  zIndex: 10,
  width: drawerWidth,
  flexShrink: 0,
  whiteSpace: 'nowrap',
  boxSizing: 'border-box',
  ...(open && {
    ...openedMixin(theme),
    [`& .${drawerClasses.paper}`]: {
      ...openedMixin(theme),
      display: 'flex',
      justifyContent: 'space-between',
    },
  }),
  ...(!open && {
    ...closedMixin(theme),
    [`& .${drawerClasses.paper}`]: {
      ...closedMixin(theme),
      display: 'flex',
      justifyContent: 'space-between',
    },
  }),
}))
