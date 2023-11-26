import { ITableMetadata } from '@plumber/types'

import { BsBricks } from 'react-icons/bs'
import { Link } from 'react-router-dom'
import { useQuery } from '@apollo/client'
import {
  Box,
  Center,
  Divider,
  Flex,
  Spinner,
  Text,
  VStack,
} from '@chakra-ui/react'
import * as URLS from 'config/urls'
import { GET_TABLES } from 'graphql/queries/get-tables'

const TileListItem = ({ table }: { table: ITableMetadata }): JSX.Element => {
  return (
    <Link to={URLS.TILE(table.id)}>
      <Flex
        px={8}
        py={4}
        w="100%"
        alignItems="center"
        gap={8}
        _hover={{
          backgroundColor: 'primary.50',
        }}
      >
        <BsBricks size={24} />
        <Box>
          <Text textStyle="h6">{table.name}</Text>
          <Text textStyle="body-2">
            {table.columns.map((c) => c.name).join(', ')}
          </Text>
        </Box>
      </Flex>
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
    <VStack alignItems="stretch" flexWrap="wrap" divider={<Divider />}>
      {data.getTables.map((tile) => (
        <TileListItem key={tile.id} table={tile} />
      ))}
    </VStack>
  )
}

export default TileList
