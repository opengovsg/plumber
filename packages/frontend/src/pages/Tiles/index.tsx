import { useQuery } from '@apollo/client'
import { Center, Flex } from '@chakra-ui/react'
import { Pagination } from '@opengovsg/design-system-react'

import Container from '@/components/Container'
import DebouncedSearchInput from '@/components/DebouncedSearchInput'
import NoResultFound from '@/components/NoResultFound'
import PageTitle from '@/components/PageTitle'
import PrimarySpinner from '@/components/PrimarySpinner'
import { PaginatedTables } from '@/graphql/__generated__/graphql'
import { GET_TABLES } from '@/graphql/queries/tiles/get-tables'
import { usePaginationAndFilter } from '@/hooks/usePaginationAndFilter'

import CreateTileButton from './components/CreateTileButton'
import EmptyTileList from './components/EmptyTileList'
import TileList from './components/TileList'

const TILES_TITLE = 'Tiles'

const TILES_PER_PAGE = 10

export default function Tiles(): JSX.Element {
  const { input, page, setSearchParams } = usePaginationAndFilter()

  const { data, loading: isTileListLoading } = useQuery<{
    getTables: PaginatedTables
  }>(GET_TABLES, {
    variables: {
      limit: TILES_PER_PAGE,
      offset: (page - 1) * TILES_PER_PAGE,
      name: input,
    },
  })

  const { pageInfo, edges } = data?.getTables || { edges: [] }
  const tilesToDisplay = edges.map(({ node }) => node)
  const hasNoTiles =
    !isTileListLoading && tilesToDisplay?.length === 0 && input.trim() === ''
  const hasNoSearchResults =
    !isTileListLoading && tilesToDisplay?.length === 0 && input.trim() !== ''

  return (
    <Container py={9}>
      <PageTitle
        title={TILES_TITLE}
        searchComponent={
          !hasNoTiles && (
            <DebouncedSearchInput
              searchValue={input}
              onChange={(input) => setSearchParams({ input })}
            />
          )
        }
        createComponent={!hasNoTiles && <CreateTileButton />}
      />
      {isTileListLoading && (
        // moved this here to prevent re-rendering of search field
        <Center h="100%">
          <PrimarySpinner fontSize="4xl" thickness="4px" margin="auto" />
        </Center>
      )}
      {hasNoTiles && <EmptyTileList />}
      {hasNoSearchResults && (
        <NoResultFound
          description="We couldn't find anything"
          action="Try using different keywords or checking for typos."
        />
      )}
      <TileList tiles={tilesToDisplay} />
      {pageInfo && pageInfo.totalCount > TILES_PER_PAGE && (
        <Flex justifyContent="center" mt={6}>
          <Pagination
            currentPage={pageInfo.currentPage}
            onPageChange={(page) => setSearchParams({ page })}
            pageSize={TILES_PER_PAGE}
            totalCount={pageInfo.totalCount}
          />
        </Flex>
      )}
    </Container>
  )
}
