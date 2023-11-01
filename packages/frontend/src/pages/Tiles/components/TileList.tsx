import { ITableMetadata } from '@plumber/types'

import { BsBricks } from 'react-icons/bs'
import { Link } from 'react-router-dom'
import { useQuery } from '@apollo/client'
import {
  Box,
  Center,
  Flex,
  ListItem,
  Spinner,
  Text,
  UnorderedList,
} from '@chakra-ui/react'
import { Tile } from '@opengovsg/design-system-react'
import * as URLS from 'config/urls'
import { GET_TABLES } from 'graphql/queries/get-tables'

const TileListItem = ({ table }: { table: ITableMetadata }): JSX.Element => {
  return (
    <Link to={URLS.TILE(table.id)}>
      <Tile variant="complex" icon={BsBricks} w={48}>
        <Box py={4}>
          <Text textStyle="h6">{table.name}</Text>
          <UnorderedList>
            {table.columns.map((column) => (
              <ListItem key={column.id}>
                <Text textStyle="body-2">{column.name}</Text>
              </ListItem>
            ))}
          </UnorderedList>
        </Box>
      </Tile>
    </Link>
  )
}

const TileList = (): JSX.Element => {
  const { data, loading } = useQuery<{ getTables: ITableMetadata[] }>(
    GET_TABLES,
  )
  if (!data?.getTables || loading) {
    return (
      <Center height="100vh">
        <Spinner size="xl" thickness="4px" color="primary.500" margin="auto" />
      </Center>
    )
  }

  return (
    <Flex gap={4} px={8} alignItems="stretch" flexWrap="wrap">
      {data.getTables.map((tile) => (
        <TileListItem key={tile.id} table={tile} />
      ))}
    </Flex>
  )
}

export default TileList
