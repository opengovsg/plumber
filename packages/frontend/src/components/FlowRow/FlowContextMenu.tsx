import { MouseEvent, useCallback, useRef, useState } from 'react'
import {
  BiDotsHorizontalRounded,
  BiDuplicate,
  BiFolder,
  BiShow,
  BiTrash,
} from 'react-icons/bi'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQuery } from '@apollo/client'
import {
  Box,
  Center,
  Flex,
  Icon,
  Menu,
  MenuButton,
  MenuItem,
  MenuList,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalHeader,
  ModalOverlay,
  Text,
  useDisclosure,
} from '@chakra-ui/react'
import {
  IconButton,
  TouchableTooltip,
  useToast,
} from '@opengovsg/design-system-react'

import MenuAlertDialog, { AlertDialogType } from '@/components/MenuAlertDialog'
import PrimarySpinner from '@/components/PrimarySpinner'
import * as URLS from '@/config/urls'
import { DELETE_FLOW } from '@/graphql/mutations/delete-flow'
import { DUPLICATE_FLOW } from '@/graphql/mutations/duplicate-flow'
import { MOVE_FLOW_TO_FOLDER } from '@/graphql/mutations/move-flow-to-folder'
import { GET_FLOW_FOLDERS } from '@/graphql/queries/get-flow-folders'
import {
  FOLDER_COLORS,
  FolderColor,
} from '@/pages/Flows/components/FolderSidebar/constants'

import type { FlowWithFolder } from './index'

interface FlowContextMenuProps {
  flow: FlowWithFolder
}

interface FolderPickerModalProps {
  isOpen: boolean
  onClose: () => void
  currentFolderId?: string | null
  onSelect: (folderId: string | null) => void
  isMoving: boolean
}

function FolderPickerModal(props: FolderPickerModalProps) {
  const { isOpen, onClose, currentFolderId, onSelect, isMoving } = props
  const { data, loading } = useQuery(GET_FLOW_FOLDERS, { skip: !isOpen })
  const folders = data?.getFlowFolders ?? []

  return (
    <Modal isOpen={isOpen} onClose={onClose} motionPreset="none" isCentered>
      <ModalOverlay bg="base.canvas.overlay" />
      <ModalContent>
        <ModalHeader>Move to folder</ModalHeader>
        <ModalCloseButton />
        <ModalBody pb={6}>
          {loading ? (
            <Center py={6}>
              <PrimarySpinner fontSize="3xl" />
            </Center>
          ) : (
            <Flex as="ul" flexDir="column" gap="2px" listStyleType="none">
              <Box as="li">
                <Flex
                  as="button"
                  type="button"
                  disabled={isMoving}
                  onClick={() => onSelect(null)}
                  align="center"
                  gap={2}
                  w="100%"
                  borderRadius={4}
                  bg={currentFolderId == null ? 'primary.100' : 'transparent'}
                  _hover={{
                    bg:
                      currentFolderId == null
                        ? 'primary.100'
                        : 'interaction.muted.neutral.hover',
                  }}
                  py={2}
                  px={2}
                  textAlign="left"
                >
                  <Text
                    textStyle="body-2"
                    fontWeight={currentFolderId == null ? 600 : 400}
                  >
                    Unfiled
                  </Text>
                </Flex>
              </Box>
              {folders.map((folder) => {
                const isSelected = currentFolderId === folder.id
                const colorToken = FOLDER_COLORS[folder.color as FolderColor]
                return (
                  <Box as="li" key={folder.id}>
                    <Flex
                      as="button"
                      type="button"
                      disabled={isMoving}
                      onClick={() => onSelect(folder.id)}
                      align="center"
                      gap={2}
                      w="100%"
                      borderRadius={4}
                      bg={isSelected ? 'primary.100' : 'transparent'}
                      _hover={{
                        bg: isSelected
                          ? 'primary.100'
                          : 'interaction.muted.neutral.hover',
                      }}
                      py={2}
                      px={2}
                      textAlign="left"
                    >
                      <Box
                        boxSize="8px"
                        borderRadius="full"
                        bg={colorToken.dot}
                        flexShrink={0}
                      />
                      <Text
                        flex={1}
                        minW={0}
                        isTruncated
                        textStyle="body-2"
                        fontWeight={isSelected ? 600 : 400}
                      >
                        {folder.name}
                      </Text>
                    </Flex>
                  </Box>
                )
              })}
            </Flex>
          )}
        </ModalBody>
      </ModalContent>
    </Modal>
  )
}

export default function FlowContextMenu(props: FlowContextMenuProps) {
  const { flow } = props
  const navigate = useNavigate()

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

  // folder picker control
  const {
    isOpen: isFolderPickerOpen,
    onOpen: onFolderPickerOpen,
    onClose: onFolderPickerClose,
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

  const [moveFlowToFolder, { loading: isMovingFlow }] = useMutation(
    MOVE_FLOW_TO_FOLDER,
    {
      refetchQueries: ['GetFlowFolders', 'GetFlows'],
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
        onDialogClose()
      },
    })
  }, [duplicateFlow, flow.id, toast, onDialogClose])

  const onDuplicateButtonClick = useCallback(
    (event: MouseEvent) => {
      event.preventDefault()
      setDialogType('duplicate')
      onDialogOpen()
    },
    [onDialogOpen],
  )

  const onMoveToFolderButtonClick = useCallback(
    (event: MouseEvent) => {
      event.preventDefault()
      onFolderPickerOpen()
    },
    [onFolderPickerOpen],
  )

  const onFolderSelect = useCallback(
    async (folderId: string | null) => {
      await moveFlowToFolder({
        variables: { input: { flowId: flow.id, folderId } },
        onCompleted: () => {
          onFolderPickerClose()
          toast({
            title: folderId
              ? 'The pipe has been moved to the folder.'
              : 'The pipe has been moved to Unfiled.',
            status: 'success',
            duration: 3000,
            isClosable: true,
            position: 'top',
          })
        },
      })
    },
    [moveFlowToFolder, flow.id, onFolderPickerClose, toast],
  )

  return (
    <>
      <Menu
        onClose={onMenuClose}
        isOpen={isMenuOpen}
        placement="bottom-end"
        isLazy
        gutter={0}
      >
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
        <MenuList w="12.5rem">
          <MenuItem
            icon={<Icon as={BiShow} boxSize={5} />}
            onClick={(event) => {
              event.preventDefault() // default behavior of the Link in the CardBody
              navigate(URLS.FLOW(flow.id))
            }}
          >
            View
          </MenuItem>
          <MenuItem
            onClick={onDuplicateButtonClick}
            icon={<Icon as={BiDuplicate} boxSize={5} />}
          >
            Duplicate
          </MenuItem>
          <MenuItem
            onClick={onMoveToFolderButtonClick}
            icon={<Icon as={BiFolder} boxSize={5} />}
          >
            Move to folder
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
        dialogHeader="Pipe"
        dialogType={dialogType}
        onClick={dialogType === 'delete' ? onFlowDelete : onFlowDuplicate}
        isLoading={dialogType === 'delete' ? isDeletingFlow : isDuplicatingFlow}
      />
      <FolderPickerModal
        isOpen={isFolderPickerOpen}
        onClose={onFolderPickerClose}
        currentFolderId={flow.folder?.id ?? null}
        onSelect={onFolderSelect}
        isMoving={isMovingFlow}
      />
    </>
  )
}
