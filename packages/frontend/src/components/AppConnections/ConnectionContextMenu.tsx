import { useCallback } from 'react'
import { Link } from 'react-router-dom'
import Menu from '@mui/material/Menu'
import MenuItem from '@mui/material/MenuItem'
import type { PopoverProps } from '@mui/material/Popover'
import * as URLS from 'config/urls'

type Action = {
  type: 'test' | 'reconnect' | 'delete' | 'viewFlows'
}

type ConnectionContextMenuProps = {
  appKey: string
  connectionId: string
  onClose: () => void
  onMenuItemClick: (event: React.MouseEvent, action: Action) => void
  anchorEl: PopoverProps['anchorEl']
}

export default function ConnectionContextMenu(
  props: ConnectionContextMenuProps,
): JSX.Element {
  const { appKey, connectionId, onClose, onMenuItemClick, anchorEl } = props

  const createActionHandler = useCallback(
    (action: Action) => {
      return function clickHandler(event: React.MouseEvent) {
        onMenuItemClick(event, action)

        onClose()
      }
    },
    [onMenuItemClick, onClose],
  )

  return (
    <Menu
      open={true}
      onClose={onClose}
      hideBackdrop={false}
      anchorEl={anchorEl}
    >
      <MenuItem
        component={Link}
        to={URLS.APP_FLOWS_FOR_CONNECTION(appKey, connectionId)}
        onClick={createActionHandler({ type: 'viewFlows' })}
      >
        View pipes
      </MenuItem>

      <MenuItem onClick={createActionHandler({ type: 'test' })}>
        Test connection
      </MenuItem>

      <MenuItem
        component={Link}
        to={URLS.APP_RECONNECT_CONNECTION(appKey, connectionId)}
        onClick={createActionHandler({ type: 'reconnect' })}
      >
        Reconnect
      </MenuItem>

      <MenuItem onClick={createActionHandler({ type: 'delete' })}>
        Delete
      </MenuItem>
    </Menu>
  )
}
