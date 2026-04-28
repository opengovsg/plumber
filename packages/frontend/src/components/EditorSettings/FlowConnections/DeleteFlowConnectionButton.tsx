import { IFlow } from '@plumber/types'

import { useCallback, useRef } from 'react'
import { BiTrash } from 'react-icons/bi'
import { useMutation } from '@apollo/client'
import { useDisclosure } from '@chakra-ui/react'
import { IconButton, TouchableTooltip } from '@opengovsg/design-system-react'

import MenuAlertDialog from '@/components/MenuAlertDialog'
import { DELETE_FLOW_CONNECTION } from '@/graphql/mutations/delete-flow-connection'
import { GET_FLOW_CONNECTIONS } from '@/graphql/queries/get-flow-connections'

import { SharedConnection } from './ConnectionsTable'

interface DeleteFlowConnectionButtonProps {
  flow: IFlow
  connection: SharedConnection
}

export default function DeleteFlowConnectionButton(
  props: DeleteFlowConnectionButtonProps,
) {
  const { flow, connection } = props
  const { connectionId, connectionName, connectionType } = connection
  const isActive = flow.active
  const isDisabled = isActive

  const cancelRef = useRef<HTMLButtonElement>(null)
  const {
    isOpen: isDialogOpen,
    onOpen: onDialogOpen,
    onClose: onDialogClose,
  } = useDisclosure()

  const [deleteConnection, { loading: isDeletingConnection }] = useMutation(
    DELETE_FLOW_CONNECTION,
    { refetchQueries: [GET_FLOW_CONNECTIONS] },
  )

  const onDeleteConnection = useCallback(async () => {
    await deleteConnection({
      variables: {
        input: { flowId: flow.id, connectionId, connectionType },
      },
      onCompleted: () => onDialogClose(),
    })
  }, [deleteConnection, flow.id, connectionId, connectionType, onDialogClose])
  return (
    <TouchableTooltip
      label={
        isActive
          ? 'You cannot delete a connection when the Pipe is published'
          : ''
      }
    >
      <IconButton
        onClick={(event) => {
          event.stopPropagation()
          onDialogOpen()
        }}
        colorScheme="critical"
        variant="clear"
        aria-label="Delete flow connection"
        icon={<BiTrash />}
        isDisabled={isDisabled}
      />
      <MenuAlertDialog
        cancelRef={cancelRef}
        isLoading={isDeletingConnection}
        isDialogOpen={isDialogOpen}
        onDialogClose={onDialogClose}
        dialogType="delete"
        dialogHeader={connectionName}
        onClick={onDeleteConnection}
        customBody="Are you sure you want to delete this shared connection? You will need to reconfigure the connection for all steps using this connection."
      />
    </TouchableTooltip>
  )
}
