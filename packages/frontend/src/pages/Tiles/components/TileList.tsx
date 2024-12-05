import { MouseEvent, useCallback, useRef } from 'react'
import { BiTrash } from 'react-icons/bi'
import { BsDot } from 'react-icons/bs'
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
  Box,
  Button,
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

import * as URLS from '@/config/urls'
import type { TableMetadata } from '@/graphql/__generated__/graphql'
import { DELETE_TABLE } from '@/graphql/mutations/tiles/delete-table'
import { GET_TABLES } from '@/graphql/queries/tiles/get-tables'
import { toPrettyDateString } from '@/helpers/dateTime'

import { TileConnections } from '..'

import {
  flexStyles,
  linkStyles,
  pulsingDotStyles,
  tagStyles,
  textStyles,
} from './style'

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
      <Flex {...linkStyles}>
        <Box>
          <Flex alignItems="center">
            <Text textStyle="h6">{table.name}</Text>
          </Flex>
          <Flex {...flexStyles.container}>
            <Text {...textStyles.lastOpened}>
              Last opened {toPrettyDateString(+table.lastAccessedAt)}
            </Text>
            {numConnections > 0 && (
              <Skeleton isLoaded={!isConnectionsLoading}>
                <Flex {...flexStyles.usedInPipes}>
                  <Icon
                    as={BsDot}
                    color="interaction.success.default"
                    sx={pulsingDotStyles}
                  />
                  <Text>Used in {numConnections} pipes</Text>
                </Flex>
              </Skeleton>
            )}
          </Flex>
        </Box>
        <Flex alignItems="center" gap={4}>
          {table.role === 'viewer' && (
            <Tag {...tagStyles}>
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
              isDisabled={isConnectionsLoading}
              onClick={onDeleteButtonClick}
              visibility="hidden"
            />
          )}
        </Flex>
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
              {numConnections > 0
                ? `Are you sure? This Tile is used in ${numConnections} pipe(s). You can't undo this action afterwards.`
                : "Are you sure? You can't undo this action afterwards."}
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
