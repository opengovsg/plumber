import { ITableMetadata } from '@plumber/types'

import { MouseEvent, useCallback, useRef } from 'react'
import { BsThreeDots, BsTrash } from 'react-icons/bs'
import { MdOutlineRemoveRedEye } from 'react-icons/md'
import { Link, useNavigate } from 'react-router-dom'
import { useMutation } from '@apollo/client'
import {
  AlertDialog,
  AlertDialogBody,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogOverlay,
  Box,
  Divider,
  Flex,
  Menu,
  MenuButton,
  MenuItem,
  MenuList,
  Text,
  useDisclosure,
  VStack,
} from '@chakra-ui/react'
import { Button, IconButton } from '@opengovsg/design-system-react'
import * as URLS from 'config/urls'
import { DELETE_TABLE } from 'graphql/mutations/tiles/delete-table'
import { GET_TABLES } from 'graphql/queries/tiles/get-tables'
import { toPrettyDateString } from 'helpers/dateTime'

const TileListItem = ({ table }: { table: ITableMetadata }): JSX.Element => {
  const navigate = useNavigate()
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
  }, [deleteTable, onDialogClose])

  return (
    <Link to={URLS.TILE(table.id)}>
      <Flex
        px={8}
        py={4}
        w="100%"
        justifyContent="space-between"
        alignItems="center"
        _hover={{
          backgroundColor: 'primary.50',
        }}
      >
        <Box>
          <Text textStyle="h6">{table.name}</Text>
          <Text textStyle="body-2">
            Last opened {toPrettyDateString(+table.lastAccessedAt)}
          </Text>
        </Box>
        <Menu onClose={onMenuClose} isOpen={isMenuOpen} gutter={0}>
          <MenuButton
            as={IconButton}
            colorScheme="secondary"
            variant="clear"
            icon={<BsThreeDots />}
            aria-label="options"
            onClick={(event) => {
              event.preventDefault()
              onMenuToggle()
            }}
          />
          <MenuList>
            <MenuItem
              icon={<MdOutlineRemoveRedEye />}
              onClick={() => navigate(URLS.TILE(table.id))}
            >
              View
            </MenuItem>
            <MenuItem
              icon={<BsTrash />}
              color="red.500"
              onClick={onDeleteButtonClick}
            >
              Delete
            </MenuItem>
          </MenuList>
        </Menu>
      </Flex>
      <AlertDialog
        isOpen={isDialogOpen}
        leastDestructiveRef={cancelRef}
        onClose={onDialogClose}
      >
        <AlertDialogOverlay>
          <AlertDialogContent>
            <AlertDialogHeader fontSize="lg" fontWeight="bold">
              Delete Tile
            </AlertDialogHeader>

            <AlertDialogBody>
              {"Are you sure? You can't undo this action afterwards."}
            </AlertDialogBody>

            <AlertDialogFooter>
              <Button
                ref={cancelRef}
                onClick={onDialogClose}
                variant="clear"
                colorScheme="secondary"
              >
                Cancel
              </Button>
              <Button
                colorScheme="red"
                onClick={deleteTile}
                ml={3}
                isLoading={isDeletingTable}
              >
                Delete
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialogOverlay>
      </AlertDialog>
    </Link>
  )
}

interface TileListProps {
  tiles: ITableMetadata[]
}

const TileList = ({ tiles }: TileListProps): JSX.Element => {
  return (
    <VStack alignItems="stretch" flexWrap="wrap" divider={<Divider />}>
      {tiles.map((tile) => (
        <TileListItem key={tile.id} table={tile} />
      ))}
    </VStack>
  )
}

export default TileList
