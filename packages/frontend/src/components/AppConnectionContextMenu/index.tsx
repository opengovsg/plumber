import * as React from 'react'
import { BiDotsHorizontalRounded } from 'react-icons/bi'
import { Link } from 'react-router-dom'
import { Menu, MenuButton, MenuItem, MenuList, Portal } from '@chakra-ui/react'
import { IconButton } from '@opengovsg/design-system-react'

import * as URLS from '@/config/urls'

type Action = {
  type: 'test' | 'edit' | 'delete' | 'viewFlows'
}

type ContextMenuProps = {
  appKey: string
  connectionId: string
  // Whether the app's auth opted into credential editing; comes from the backend
  // via GetAppConnections.
  supportsConnectionEdit?: boolean
  onMenuItemClick: (event: React.MouseEvent, action: Action) => void
}

export default function ContextMenu(
  props: ContextMenuProps,
): React.ReactElement {
  const { appKey, connectionId, supportsConnectionEdit, onMenuItemClick } = props

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

          {supportsConnectionEdit ? (
            <MenuItem
              as={Link}
              to={URLS.APP_EDIT_CONNECTION(appKey, connectionId)}
              onClick={createActionHandler({ type: 'edit' })}
            >
              Edit connection
            </MenuItem>
          ) : null}

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
