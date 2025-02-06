import type { IFlow } from '@plumber/types'

import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Box, Center, Container, Flex } from '@chakra-ui/react'
import { Pagination } from '@opengovsg/design-system-react'

import DebouncedSearchInput from '@/components/DebouncedSearchInput'
import FlowRow from '@/components/FlowRow'
import NoResultFound from '@/components/NoResultFound'
import PageTitle from '@/components/PageTitle'
import PrimarySpinner from '@/components/PrimarySpinner'
import * as URLS from '@/config/urls'
import { PageInfo } from '@/graphql/__generated__/graphql'
import { usePaginationAndFilter } from '@/hooks/usePaginationAndFilter'

const RESULTS_PER_PAGE = 10
const EXECUTIONS_TITLE = 'Select a pipe to view executions'

interface FlowsInternalProps {
  isLoading: boolean
  isSearching: boolean
  flows: IFlow[]
}

function FlowsList({ isLoading, isSearching, flows }: FlowsInternalProps) {
  const hasFlows = flows.length > 0
  const hasNoUserFlows = !hasFlows && !isSearching
  const isEmptySearchResults = !hasFlows && isSearching

  if (isLoading) {
    return (
      <Center mt={8}>
        <PrimarySpinner fontSize="4xl" />
      </Center>
    )
  }

  if (hasNoUserFlows) {
    return <>No Executions</>
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
    <Box>
      {flows.map((flow) => (
        <FlowRow
          key={flow.id}
          flow={flow}
          isExecution={true}
          showMenu={false}
          showTimestamp={false}
        />
      ))}
    </Box>
  )
}

interface FlowsListPageProps {
  loading: boolean
  flows: IFlow[]
  pageInfo: PageInfo
}

export default function FlowListPage({
  loading,
  flows,
  pageInfo,
}: FlowsListPageProps) {
  const { input, page, status, setSearchParams, isSearching } =
    usePaginationAndFilter()
  const navigate = useNavigate()

  const totalCount: number = pageInfo?.totalCount ?? 0
  const hasPagination = !loading && totalCount > RESULTS_PER_PAGE
  const hasNoUserFlows = flows.length === 0 && !isSearching

  // ensure invalid pages won't be accessed even after deleting flows
  const lastPage = Math.ceil(totalCount / RESULTS_PER_PAGE)
  useEffect(() => {
    // Defer the search params update till after the initial render
    if (lastPage !== 0 && page > lastPage) {
      setSearchParams({ page: lastPage })
    }
  }, [lastPage, page, setSearchParams])

  useEffect(() => {
    if (!loading && input && flows.length > 0 && status === 'failure') {
      const pipeId = flows.filter((f) => f.name === input)?.[0]?.id
      if (pipeId) {
        navigate(`${URLS.EXECUTION_FLOW(pipeId)}&status=failure`, {
          replace: true,
        })
      } else {
        setSearchParams({ status: '' })
      }
    }
  }, [loading, flows, input, navigate, status, setSearchParams])

  return (
    <Container py={9}>
      {!hasNoUserFlows && (
        <PageTitle
          title={EXECUTIONS_TITLE}
          searchComponent={
            <DebouncedSearchInput
              searchValue={input}
              onChange={(input) => setSearchParams({ input })}
            />
          }
        />
      )}

      <FlowsList flows={flows} isLoading={loading} isSearching={isSearching} />

      {hasPagination && (
        <Flex justifyContent="center" mt={6}>
          <Pagination
            currentPage={pageInfo?.currentPage}
            onPageChange={(page) => setSearchParams({ page })}
            pageSize={RESULTS_PER_PAGE}
            totalCount={totalCount}
          />
        </Flex>
      )}
    </Container>
  )
}
