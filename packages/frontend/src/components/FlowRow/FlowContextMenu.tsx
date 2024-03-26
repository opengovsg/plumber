import { IFlow } from '@plumber/types'

import { MouseEvent, useCallback, useRef } from 'react'
import { BiDotsHorizontalRounded } from 'react-icons/bi'
import { BsTrash } from 'react-icons/bs'
import { MdOutlineRemoveRedEye } from 'react-icons/md'
import { Link } from 'react-router-dom'
import { useMutation } from '@apollo/client'
import {
  AlertDialog,
  AlertDialogBody,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogOverlay,
  Menu,
  MenuButton,
  MenuItem,
  MenuList,
  useDisclosure,
} from '@chakra-ui/react'
import {
  Button,
  IconButton,
  TouchableTooltip,
  useToast,
} from '@opengovsg/design-system-react'
import * as URLS from 'config/urls'
import { DELETE_FLOW } from 'graphql/mutations/delete-flow'

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
          icon={<BiDotsHorizontalRounded />}
          variant="clear"
          onClick={(event) => {
            event.preventDefault()
            onMenuToggle()
          }}
        />
        <MenuList>
          <MenuItem
            as={Link}
            to={URLS.FLOW(flow.id)}
            icon={<MdOutlineRemoveRedEye />}
          >
            View
          </MenuItem>
          <TouchableTooltip
            label={flowTransfer ? 'Transfer Requested' : ''}
            aria-label="Delete Flow Warning"
          >
            <MenuItem
              isDisabled={!!flowTransfer}
              onClick={onDeleteButtonClick}
              icon={<BsTrash />}
              color="red.500"
            >
              Delete
            </MenuItem>
          </TouchableTooltip>
        </MenuList>
      </Menu>
      <AlertDialog
        isOpen={isDialogOpen}
        leastDestructiveRef={cancelRef}
        onClose={onDialogClose}
      >
        <AlertDialogOverlay>
          <AlertDialogContent>
            <AlertDialogHeader fontSize="lg" fontWeight="bold">
              Delete Pipe
            </AlertDialogHeader>

            <AlertDialogBody>
              {
                "Are you sure you want to delete this pipe? You can't undo this action afterwards."
              }
            </AlertDialogBody>

            <AlertDialogFooter>
              <Button
                variant="clear"
                colorScheme="secondary"
                ref={cancelRef}
                onClick={onDialogClose}
              >
                Cancel
              </Button>
              <Button onClick={onFlowDelete} ml={3} isLoading={isDeletingFlow}>
                Delete
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialogOverlay>
      </AlertDialog>
    </>
  )
}
