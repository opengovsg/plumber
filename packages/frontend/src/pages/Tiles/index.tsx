import { ITableMetadata } from '@plumber/types'

import { useQuery } from '@apollo/client'
import { Center, Flex } from '@chakra-ui/react'

import Container from '@/components/Container'
import PageTitle from '@/components/PageTitle'
import PrimarySpinner from '@/components/PrimarySpinner'
import { GET_TABLES } from '@/graphql/queries/tiles/get-tables'

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
        <PrimarySpinner fontSize="4xl" thickness="4px" margin="auto" />
      </Center>
    )
  }

  const isEmpty = data.getTables.length === 0
  return (
    <Container py={9}>
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
