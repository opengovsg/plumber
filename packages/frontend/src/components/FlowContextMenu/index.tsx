import * as React from 'react'
import { Link } from 'react-router-dom'
import { useMutation } from '@apollo/client'
import Menu from '@mui/material/Menu'
import MenuItem from '@mui/material/MenuItem'
import type { PopoverProps } from '@mui/material/Popover'
import { useToast } from '@opengovsg/design-system-react'
import * as URLS from 'config/urls'
import { DELETE_FLOW } from 'graphql/mutations/delete-flow'
import useFormatMessage from 'hooks/useFormatMessage'

type ContextMenuProps = {
  flowId: string
  onClose: () => void
  anchorEl: PopoverProps['anchorEl']
}

export default function ContextMenu(
  props: ContextMenuProps,
): React.ReactElement {
  const { flowId, onClose, anchorEl } = props
  const toast = useToast()
  const [deleteFlow] = useMutation(DELETE_FLOW)
  // TODO (mal): add check to disable button when user tries to delete pipe with ongoing transfer request
  const formatMessage = useFormatMessage()

  const onFlowDelete = React.useCallback(async () => {
    await deleteFlow({
      variables: { input: { id: flowId } },
      update: (cache) => {
        const flowCacheId = cache.identify({
          __typename: 'Flow',
          id: flowId,
        })

        cache.evict({
          id: flowCacheId,
        })
      },
    })

    toast({
      title: 'The pipe and associated executions have been deleted.',
      status: 'success',
      duration: 3000,
      isClosable: true,
      position: 'bottom-right',
    })
  }, [deleteFlow, flowId, toast])

  return (
    <Menu
      open={true}
      onClose={onClose}
      hideBackdrop={false}
      anchorEl={anchorEl}
    >
      <MenuItem component={Link} to={URLS.FLOW(flowId)}>
        {formatMessage('flow.view')}
      </MenuItem>

      <MenuItem onClick={onFlowDelete}>{formatMessage('flow.delete')}</MenuItem>
    </Menu>
  )
}
