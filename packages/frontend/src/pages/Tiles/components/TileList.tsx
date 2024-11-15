import { MouseEvent, useCallback, useRef } from 'react'
import { BiTrash } from 'react-icons/bi'
import { BsDot } from 'react-icons/bs'
import { MdOutlineRemoveRedEye } from 'react-icons/md'
import { Link } from 'react-router-dom'
import { useMutation } from '@apollo/client'
import {
  Box,
  Divider,
  Flex,
  Icon,
  Skeleton,
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

import { TileConnections } from '..'

const TileListItem = ({
  isConnectionsLoading,
  numConnections,
  table,
}: {
  isConnectionsLoading: boolean
  numConnections: number
  table: TableMetadata
}): JSX.Element => {
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
          '& .hover-remove-button': {
            visibility: 'visible',
          },
        }}
        _active={{
          bg: 'interaction.muted.neutral.active',
        }}
      >
        <Box>
          <Text textStyle="h6">{table.name}</Text>
          <Flex gap={1} textStyle="body-2" color="base.content.medium">
            <Text>Last opened {toPrettyDateString(+table.lastAccessedAt)}</Text>
            {table.role !== 'viewer' && numConnections && (
              <>
                <Icon as={BsDot} fontSize="1.5em" />
                <Skeleton isLoaded={!isConnectionsLoading}>
                  <Text>Used in {numConnections} pipes</Text>
                </Skeleton>
              </>
            )}
          </Flex>
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
          {table.role === 'owner' && (
            <IconButton
              className="hover-remove-button"
              variant="clear"
              aria-label="Remove"
              icon={<BiTrash />}
              onClick={onDeleteButtonClick}
              visibility="hidden"
            />
          )}
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
  isConnectionsLoading: boolean
  tileConnections: TileConnections
  tiles: TableMetadata[]
}

const TileList = ({
  isConnectionsLoading,
  tileConnections,
  tiles,
}: TileListProps): JSX.Element => {
  return (
    <VStack
      alignItems="stretch"
      flexWrap="wrap"
      divider={<Divider />}
      spacing={0}
    >
      {tiles.map((tile) => (
        <TileListItem
          key={tile.id}
          isConnectionsLoading={isConnectionsLoading}
          numConnections={tileConnections[tile.id]}
          table={tile}
        />
      ))}
    </VStack>
  )
}

export default TileList
