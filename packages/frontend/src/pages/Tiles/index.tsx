import { useEffect } from 'react'
import { useQuery } from '@apollo/client'
import { Center, Flex } from '@chakra-ui/react'
import { Pagination } from '@opengovsg/design-system-react'

import Container from '@/components/Container'
import DebouncedSearchInput from '@/components/DebouncedSearchInput'
import NoResultFound from '@/components/NoResultFound'
import PageTitle from '@/components/PageTitle'
import PrimarySpinner from '@/components/PrimarySpinner'
import { PaginatedTables, TableMetadata } from '@/graphql/__generated__/graphql'
import { GET_TABLE_CONNECTIONS } from '@/graphql/queries/tiles/get-table-connections'
import { GET_TABLES } from '@/graphql/queries/tiles/get-tables'
import { usePaginationAndFilter } from '@/hooks/usePaginationAndFilter'

import CreateTileButton from './components/CreateTileButton'
import EmptyTileList from './components/EmptyTileList'
import TileList from './components/TileList'

const TILES_TITLE = 'Tiles'

const TILES_PER_PAGE = 10

export interface TileConnections {
  [key: string]: number
}
interface TilesContentProps {
  isLoading: boolean
  isSearching: boolean
  isConnectionsLoading: boolean
  tiles: TableMetadata[]
  tileConnections: TileConnections
}

function TilesContent({
  isConnectionsLoading,
  isLoading,
  isSearching,
  tileConnections,
  tiles,
}: TilesContentProps) {
  const hasTiles = tiles.length > 0

  const hasNoUserTiles = !hasTiles && !isSearching
  const isEmptySearchResults = !hasTiles && isSearching

  if (isLoading) {
    return (
      // moved this here to prevent re-rendering of search field
      <Center h="100%">
        <PrimarySpinner fontSize="4xl" thickness="4px" margin="auto" />
      </Center>
    )
  }
  if (hasNoUserTiles) {
    return <EmptyTileList />
  }
  if (isEmptySearchResults) {
    return (
      <NoResultFound
        description="We couldn't find anything"
        action="Try using different keywords or checking for typos."
      />
    )
  }
  return (
    <TileList
      isConnectionsLoading={isConnectionsLoading}
      tileConnections={tileConnections}
      tiles={tiles}
    />
  )
}

export default function Tiles(): JSX.Element {
  const { input, page, setSearchParams, isSearching } = usePaginationAndFilter()

  const queryVars = {
    limit: TILES_PER_PAGE,
    offset: (page - 1) * TILES_PER_PAGE,
    name: input,
  }

  const { data, loading } = useQuery<{
    getTables: PaginatedTables
  }>(GET_TABLES, {
    variables: queryVars,
  })

  const { pageInfo, edges } = data?.getTables ?? {}
  const tilesToDisplay = edges?.map(({ node }) => node) ?? []

  const hasNoUserTiles = tilesToDisplay.length === 0 && !isSearching
  const totalCount: number = pageInfo?.totalCount ?? 0
  const hasPagination = !loading && pageInfo && totalCount > TILES_PER_PAGE

  const { data: connectionsData, loading: isConnectionsLoading } = useQuery<{
    getTableConnections: JSON
  }>(GET_TABLE_CONNECTIONS, {
    variables: queryVars,
    skip: hasNoUserTiles,
  })
  const tileConnections = connectionsData?.getTableConnections ?? {}

  // ensure invalid pages won't be accessed even after deleting tiles
  const lastPage = Math.ceil(totalCount / TILES_PER_PAGE)
  useEffect(() => {
    // Defer the search params update till after the initial render
    if (lastPage !== 0 && page > lastPage) {
      setSearchParams({ page: lastPage })
    }
  }, [lastPage, page, setSearchParams])

  return (
    <Container py={9}>
      <PageTitle
        title={TILES_TITLE}
        searchComponent={
          !hasNoUserTiles && (
            <DebouncedSearchInput
              searchValue={input}
              onChange={(input) => setSearchParams({ input })}
            />
          )
        }
        createComponent={!hasNoUserTiles && <CreateTileButton />}
      />

      <TilesContent
        isConnectionsLoading={isConnectionsLoading}
        isLoading={loading}
        isSearching={isSearching}
        tileConnections={tileConnections}
        tiles={tilesToDisplay}
      />

      {hasPagination && (
        <Flex justifyContent="center" mt={6}>
          <Pagination
            currentPage={pageInfo.currentPage}
            onPageChange={(page) => setSearchParams({ page })}
            pageSize={TILES_PER_PAGE}
            totalCount={totalCount}
          />
        </Flex>
      )}
    </Container>
  )
}
