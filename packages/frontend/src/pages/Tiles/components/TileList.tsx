import { ITableMetadata } from '@plumber/types'

import { MouseEvent, useCallback, useRef } from 'react'
import { BiDotsHorizontalRounded, BiShow, BiTrash } from 'react-icons/bi'
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
  Icon,
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
              onClick={() => navigate(URLS.TILE(table.id))}
            >
              View
            </MenuItem>
            <MenuItem
              icon={<Icon as={BiTrash} boxSize={5} />}
              color="interaction.critical.default"
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
            <AlertDialogHeader>Delete Tile</AlertDialogHeader>

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
                colorScheme="critical"
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
