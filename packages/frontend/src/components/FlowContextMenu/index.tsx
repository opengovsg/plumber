import * as React from 'react'
import { Link } from 'react-router-dom'
import { useMutation } from '@apollo/client'
import Menu from '@mui/material/Menu'
import MenuItem from '@mui/material/MenuItem'
import type { PopoverProps } from '@mui/material/Popover'
import * as URLS from 'config/urls'
import { DELETE_FLOW } from 'graphql/mutations/delete-flow'
import useFormatMessage from 'hooks/useFormatMessage'
import { useSnackbar } from 'notistack'

type ContextMenuProps = {
  flowId: string
  onClose: () => void
  anchorEl: PopoverProps['anchorEl']
}

export default function ContextMenu(
  props: ContextMenuProps,
): React.ReactElement {
  const { flowId, onClose, anchorEl } = props
  const { enqueueSnackbar } = useSnackbar()
  const [deleteFlow] = useMutation(DELETE_FLOW)
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

    enqueueSnackbar(formatMessage('flow.successfullyDeleted'), {
      variant: 'success',
    })
  }, [deleteFlow, flowId, enqueueSnackbar, formatMessage])

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
