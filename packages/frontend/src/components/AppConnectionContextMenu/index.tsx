import * as React from 'react'
import { BiDotsHorizontalRounded } from 'react-icons/bi'
import { Link } from 'react-router-dom'
import { Menu, MenuButton, MenuItem, MenuList, Portal } from '@chakra-ui/react'
import { IconButton } from '@opengovsg/design-system-react'

import * as URLS from '@/config/urls'

type Action = {
  type: 'test' | 'reconnect' | 'delete' | 'viewFlows'
}

type ContextMenuProps = {
  appKey: string
  connectionId: string
  onMenuItemClick: (event: React.MouseEvent, action: Action) => void
}

export default function ContextMenu(
  props: ContextMenuProps,
): React.ReactElement {
  const { appKey, connectionId, onMenuItemClick } = props

  const createActionHandler = React.useCallback(
    (action: Action) => {
      return function clickHandler(event: React.MouseEvent) {
        onMenuItemClick(event, action)
      }
    },
    [onMenuItemClick],
  )

  return (
    <Menu>
      <MenuButton
        as={IconButton}
        aria-label="More options"
        size="md"
        variant="clear"
        colorScheme="default"
        icon={<BiDotsHorizontalRounded />}
        justifyContent="center"
        alignItems="center"
      />
      {/* Not adding a portal causes the menu list to add a weird height to the parent */}
      <Portal>
        <MenuList my={-1}>
          <MenuItem
            as={Link}
            to={URLS.APP_FLOWS_FOR_CONNECTION(appKey, connectionId)}
            onClick={createActionHandler({ type: 'viewFlows' })}
          >
            View pipes
          </MenuItem>

          <MenuItem onClick={createActionHandler({ type: 'test' })}>
            Test connection
          </MenuItem>

          {/* TODO: deprecate this action */}
          <MenuItem
            as={Link}
            to={URLS.APP_RECONNECT_CONNECTION(appKey, connectionId)}
            onClick={createActionHandler({ type: 'reconnect' })}
          >
            Edit connection
          </MenuItem>

          <MenuItem
            onClick={createActionHandler({ type: 'delete' })}
            color="red.500"
          >
            Delete
          </MenuItem>
        </MenuList>
      </Portal>
    </Menu>
  )
}
