import * as React from 'react'
import { useNavigate } from 'react-router-dom'
import ForumIcon from '@mui/icons-material/Forum'
import LogoutIcon from '@mui/icons-material/Logout'
import PersonIcon from '@mui/icons-material/Person'
import {
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  MenuProps,
} from '@mui/material'
import * as URLS from 'config/urls'
import apolloClient from 'graphql/client'
import useAuthentication from 'hooks/useAuthentication'
import useCurrentUser from 'hooks/useCurrentUser'
import useFormatMessage from 'hooks/useFormatMessage'

type AccountDropdownMenuProps = {
  open: boolean
  onClose: () => void
  anchorEl: MenuProps['anchorEl']
  id: string
}

function AccountDropdownMenu(
  props: AccountDropdownMenuProps,
): React.ReactElement {
  const formatMessage = useFormatMessage()
  const { updateToken } = useAuthentication()
  const user = useCurrentUser()
  const navigate = useNavigate()

  const { open, onClose, anchorEl, id } = props

  const logout = async () => {
    updateToken('')
    await apolloClient.clearStore()

    onClose()

    navigate(URLS.ROOT)
  }

  return (
    <Menu
      anchorEl={anchorEl}
      anchorOrigin={{
        vertical: 'bottom',
        horizontal: 'right',
      }}
      id={id}
      keepMounted
      transformOrigin={{
        vertical: 'top',
        horizontal: 'right',
      }}
      open={open}
      onClose={onClose}
    >
      <MenuItem
        sx={{
          pointerEvents: 'none',
        }}
      >
        <ListItemIcon>
          <PersonIcon fontSize="small" />
        </ListItemIcon>
        <ListItemText>{user?.email}</ListItemText>
      </MenuItem>

      <MenuItem divider>
        <ListItemIcon>
          <ForumIcon fontSize="small" />
        </ListItemIcon>
        <ListItemText
          onClick={() => window.open(URLS.FEEDBACK_FORM_LINK, '_blank')}
        >
          Give feedback
        </ListItemText>
      </MenuItem>

      <MenuItem onClick={logout} data-test="logout-item">
        <ListItemIcon>
          <LogoutIcon fontSize="small" color="error" />
        </ListItemIcon>
        <ListItemText>
          {formatMessage('accountDropdownMenu.logout')}
        </ListItemText>
      </MenuItem>
    </Menu>
  )
}

export default AccountDropdownMenu
