import { ITableMetadata } from '@plumber/types'

import { useQuery } from '@apollo/client'
import { Center, Flex, Spinner } from '@chakra-ui/react'
import Container from 'components/Container'
import PageTitle from 'components/PageTitle'
import { GET_TABLES } from 'graphql/queries/get-tables'

import CreateTileButton from './components/CreateTileButton'
import EmptyTileList from './components/EmptyTileList'
import TileList from './components/TileList'

const TILES_TITLE = 'Tiles'

export default function Tiles(): JSX.Element {
  const { data, loading: isTileListLoading } = useQuery<{
    getTables: ITableMetadata[]
  }>(GET_TABLES)

  if (!data?.getTables || isTileListLoading) {
    return (
      <Center h="100%">
        <Spinner size="xl" thickness="4px" color="primary.500" margin="auto" />
      </Center>
    )
  }

  const isEmpty = data.getTables.length === 0
  return (
    <Container py={7}>
      <Flex
        flexDir="column"
        justifyContent="space-between"
        alignItems="stretch"
        gap={8}
      >
        <Flex
          pl={{ base: 0, sm: 8 }}
          alignItems="center"
          justifyContent="space-between"
        >
          <PageTitle title={TILES_TITLE} />
          {!isEmpty && <CreateTileButton />}
        </Flex>
        {isEmpty ? <EmptyTileList /> : <TileList tiles={data.getTables} />}
      </Flex>
    </Container>
  )
}
