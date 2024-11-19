import { MouseEvent, useCallback, useRef } from 'react'
import { BiDotsHorizontalRounded, BiShow, BiTrash } from 'react-icons/bi'
import { MdOutlineRemoveRedEye } from 'react-icons/md'
import { Link, useNavigate } from 'react-router-dom'
import { useMutation } from '@apollo/client'
import {
  Box,
  Divider,
  Flex,
  Icon,
  Menu,
  MenuButton,
  MenuItem,
  MenuList,
  Text,
  useDisclosure,
  VStack,
} from '@chakra-ui/react'
import {
  IconButton,
  Tag,
  TagLabel,
  TagLeftIcon,
  useToast,
} from '@opengovsg/design-system-react'

import MenuAlertDialog from '@/components/MenuAlertDialog'
import * as URLS from '@/config/urls'
import type { TableMetadata } from '@/graphql/__generated__/graphql'
import { DELETE_TABLE } from '@/graphql/mutations/tiles/delete-table'
import { GET_TABLES } from '@/graphql/queries/tiles/get-tables'
import { toPrettyDateString } from '@/helpers/dateTime'

const TileListItem = ({ table }: { table: TableMetadata }): JSX.Element => {
  const navigate = useNavigate()
  const toast = useToast()
  const [deleteTable, { loading: isDeletingTable }] = useMutation(
    DELETE_TABLE,
    {
      variables: {
        input: {
          id: table.id,
        },
      },
      refetchQueries: [GET_TABLES],
    },
  )
  const cancelRef = useRef(null)
  const {
    isOpen: isDialogOpen,
    onOpen: onDialogOpen,
    onClose: onDialogClose,
  } = useDisclosure()
  // need to manage state to prevent bubbling of click event
  const {
    isOpen: isMenuOpen,
    onToggle: onMenuToggle,
    onClose: onMenuClose,
  } = useDisclosure()

  const onDeleteButtonClick = useCallback(
    (e: MouseEvent) => {
      e.preventDefault()
      onDialogOpen()
    },
    [onDialogOpen],
  )

  const deleteTile = useCallback(async () => {
    await deleteTable()
    onDialogClose()
    toast({
      title: 'The tile has been deleted.',
      status: 'success',
      duration: 3000,
      isClosable: true,
      position: 'top',
    })
  }, [deleteTable, onDialogClose, toast])

  return (
    <Link to={URLS.TILE(table.id)}>
      <Flex
        px={8}
        py={6}
        w="100%"
        justifyContent="space-between"
        alignItems="center"
        _hover={{
          bg: 'interaction.muted.neutral.hover',
        }}
        _active={{
          bg: 'interaction.muted.neutral.active',
        }}
      >
        <Box>
          <Text textStyle="h6">{table.name}</Text>
          <Text textStyle="body-2">
            Last opened {toPrettyDateString(+table.lastAccessedAt)}
          </Text>
        </Box>
        <Flex alignItems="center" gap={4}>
          {table.role === 'viewer' && (
            <Tag
              colorScheme="secondary"
              size="xs"
              variant="subtle"
              py={2}
              gap={1}
              pointerEvents="none"
            >
              <TagLeftIcon as={MdOutlineRemoveRedEye} />
              <TagLabel>View only</TagLabel>
            </Tag>
          )}
          <Menu onClose={onMenuClose} isOpen={isMenuOpen} gutter={0}>
            <MenuButton
              as={IconButton}
              colorScheme="secondary"
              variant="clear"
              icon={<BiDotsHorizontalRounded />}
              aria-label="options"
              onClick={(event) => {
                event.preventDefault()
                onMenuToggle()
              }}
            />
            <MenuList w={144}>
              <MenuItem
                icon={<Icon as={BiShow} boxSize={5} />}
                onClick={(event) => {
                  event.preventDefault() // default behavior of the Link in the parent
                  navigate(URLS.TILE(table.id))
                }}
              >
                View
              </MenuItem>
              {table.role === 'owner' && (
                <MenuItem
                  icon={<Icon as={BiTrash} boxSize={5} />}
                  color="interaction.critical.default"
                  onClick={onDeleteButtonClick}
                >
                  Delete
                </MenuItem>
              )}
            </MenuList>
          </Menu>
        </Flex>
      </Flex>
      <MenuAlertDialog
        isDialogOpen={isDialogOpen}
        cancelRef={cancelRef}
        onDialogClose={onDialogClose}
        dialogHeader="Tile"
        dialogType="delete"
        onClick={deleteTile}
        isLoading={isDeletingTable}
      />
    </Link>
  )
}

interface TileListProps {
  tiles: TableMetadata[]
}

const TileList = ({ tiles }: TileListProps): JSX.Element => {
  return (
    <VStack
      alignItems="stretch"
      flexWrap="wrap"
      divider={<Divider />}
      spacing={0}
    >
      {tiles.map((tile) => (
        <TileListItem key={tile.id} table={tile} />
      ))}
    </VStack>
  )
}

export default TileList
