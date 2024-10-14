import { useSearchParams } from 'react-router-dom'
import { useQuery } from '@apollo/client'
import { Center, Flex } from '@chakra-ui/react'
import { Pagination } from '@opengovsg/design-system-react'

import Container from '@/components/Container'
import PageTitle from '@/components/PageTitle'
import PrimarySpinner from '@/components/PrimarySpinner'
import { PaginatedTables } from '@/graphql/__generated__/graphql'
import { GET_TABLES } from '@/graphql/queries/tiles/get-tables'

import CreateTileButton from './components/CreateTileButton'
import EmptyTileList from './components/EmptyTileList'
import TileList from './components/TileList'

const TILES_TITLE = 'Tiles'

const TILES_PER_PAGE = 10

export default function Tiles(): JSX.Element {
  const [searchParams, setSearchParams] = useSearchParams()
  const page = parseInt(searchParams.get('page') || '', 10) || 1

  const { data, loading: isTileListLoading } = useQuery<{
    getTables: PaginatedTables
  }>(GET_TABLES, {
    variables: {
      limit: TILES_PER_PAGE,
      offset: (page - 1) * TILES_PER_PAGE,
    },
  })

  if (!data?.getTables || isTileListLoading) {
    return (
      <Center h="100%">
        <PrimarySpinner fontSize="4xl" thickness="4px" margin="auto" />
      </Center>
    )
  }

  const { pageInfo, edges } = data.getTables || {}
  const tilesToDisplay = edges.map(({ node }) => node)
  const isEmpty = tilesToDisplay?.length === 0

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
        {isEmpty ? <EmptyTileList /> : <TileList tiles={tilesToDisplay} />}
      </Flex>
      {pageInfo && pageInfo.totalCount > TILES_PER_PAGE && (
        <Flex justifyContent="center" mt={6}>
          <Pagination
            currentPage={pageInfo.currentPage}
            onPageChange={(page) =>
              setSearchParams(page === 1 ? {} : { page: page.toString() })
            }
            pageSize={TILES_PER_PAGE}
            totalCount={pageInfo.totalCount}
          />
        </Flex>
      )}
    </Container>
  )
}
