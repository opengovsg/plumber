import { IFlow } from '@plumber/types'

import { MouseEvent, useCallback, useRef, useState } from 'react'
import {
  BiDotsHorizontalRounded,
  BiDuplicate,
  BiShow,
  BiTrash,
} from 'react-icons/bi'
import { Link } from 'react-router-dom'
import { useMutation } from '@apollo/client'
import {
  Icon,
  Menu,
  MenuButton,
  MenuItem,
  MenuList,
  useDisclosure,
} from '@chakra-ui/react'
import {
  IconButton,
  TouchableTooltip,
  useToast,
} from '@opengovsg/design-system-react'
import * as URLS from 'config/urls'
import { DELETE_FLOW } from 'graphql/mutations/delete-flow'
import { DUPLICATE_FLOW } from 'graphql/mutations/duplicate-flow'

import MenuAlertDialog, { AlertDialogType } from './MenuAlertDialog'

interface FlowContextMenuProps {
  flow: IFlow
}

export default function FlowContextMenu(props: FlowContextMenuProps) {
  const { flow } = props

  // dialog control
  const {
    isOpen: isDialogOpen,
    onOpen: onDialogOpen,
    onClose: onDialogClose,
  } = useDisclosure()
  const [dialogType, setDialogType] = useState<AlertDialogType>('delete') // delete by default

  // menu control
  const {
    isOpen: isMenuOpen,
    onToggle: onMenuToggle,
    onClose: onMenuClose,
  } = useDisclosure()

  const cancelRef = useRef<HTMLButtonElement>(null)
  const toast = useToast()
  const [deleteFlow, { loading: isDeletingFlow }] = useMutation(DELETE_FLOW)
  const flowTransfer = flow?.pendingTransfer

  const [duplicateFlow, { loading: isDuplicatingFlow }] = useMutation(
    DUPLICATE_FLOW,
    {
      refetchQueries: ['GetFlows'],
    },
  )

  // for deleting pipe
  const onFlowDelete = useCallback(async () => {
    await deleteFlow({
      variables: { input: { id: flow.id } },
      update: (cache) => {
        const flowCacheId = cache.identify({
          __typename: 'Flow',
          id: flow.id,
        })

        cache.evict({
          id: flowCacheId,
        })
      },
      onCompleted: () => {
        onDialogClose()
        toast({
          title: 'The pipe and associated executions have been deleted.',
          status: 'success',
          duration: 3000,
          isClosable: true,
          position: 'top',
        })
      },
    })
  }, [deleteFlow, flow.id, toast, onDialogClose])

  const onDeleteButtonClick = useCallback(
    (event: MouseEvent) => {
      event.preventDefault()
      setDialogType('delete')
      onDialogOpen()
    },
    [onDialogOpen],
  )

  // for duplicating pipe
  const onFlowDuplicate = useCallback(async () => {
    await duplicateFlow({
      variables: { input: { id: flow.id } },
      onCompleted: () => {
        toast({
          title: 'The pipe has been successfully duplicated.',
          status: 'success',
          duration: 3000,
          isClosable: true,
          position: 'top',
        })
      },
    })
  }, [duplicateFlow, flow.id, toast])

  const onDuplicateButtonClick = useCallback(
    (event: MouseEvent) => {
      event.preventDefault()
      setDialogType('duplicate')
      onDialogOpen()
    },
    [onDialogOpen],
  )

  return (
    <>
      <Menu onClose={onMenuClose} isOpen={isMenuOpen} placement="bottom-end">
        <MenuButton
          as={IconButton}
          aria-label="Flow Row Menu Options"
          colorScheme="secondary"
          icon={<BiDotsHorizontalRounded />}
          variant="clear"
          onClick={(event) => {
            event.preventDefault()
            onMenuToggle()
          }}
        />
        <MenuList w="12.6875rem">
          <MenuItem
            as={Link}
            to={URLS.FLOW(flow.id)}
            icon={<Icon as={BiShow} boxSize={5} />}
          >
            View
          </MenuItem>
          <MenuItem
            onClick={onDuplicateButtonClick}
            icon={<Icon as={BiDuplicate} boxSize={5} />}
          >
            Duplicate
          </MenuItem>
          <TouchableTooltip
            label={
              flowTransfer
                ? 'You cannot delete a pipe with a pending transfer'
                : ''
            }
            aria-label="Delete Flow Warning"
          >
            <MenuItem
              isDisabled={!!flowTransfer}
              onClick={onDeleteButtonClick}
              icon={<Icon as={BiTrash} boxSize={5} />}
              color="interaction.critical.default"
            >
              Delete
            </MenuItem>
          </TouchableTooltip>
        </MenuList>
      </Menu>
      <MenuAlertDialog
        isDialogOpen={isDialogOpen}
        cancelRef={cancelRef}
        onDialogClose={onDialogClose}
        type={dialogType}
        onClick={dialogType === 'delete' ? onFlowDelete : onFlowDuplicate}
        isLoading={dialogType === 'delete' ? isDeletingFlow : isDuplicatingFlow}
      />
    </>
  )
}
