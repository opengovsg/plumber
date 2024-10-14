import type { IExecution } from '@plumber/types'

import { ReactElement } from 'react'
import { useQuery } from '@apollo/client'
import { Center, Flex } from '@chakra-ui/react'
import { Pagination } from '@opengovsg/design-system-react'

import Container from '@/components/Container'
import ExecutionRow from '@/components/ExecutionRow'
import { StatusType } from '@/components/ExecutionStatusMenu'
import NoResultFound from '@/components/NoResultFound'
import PageTitle from '@/components/PageTitle'
import PrimarySpinner from '@/components/PrimarySpinner'
import { GET_EXECUTIONS } from '@/graphql/queries/get-executions'
import { usePaginationAndFilter } from '@/hooks/usePaginationAndFilter'

import SearchWithFilterInput from './components/SearchWithFilterInput'

const EXECUTION_PER_PAGE = 10
const EXECUTIONS_TITLE = 'Executions'

interface ExecutionParameters {
  page: number
  status: string
  input: string
}

interface ExecutionsListProps {
  executions: IExecution[]
  isSearching: boolean
  isLoading: boolean
}

const getLimitAndOffset = (params: ExecutionParameters) => ({
  limit: EXECUTION_PER_PAGE,
  offset: (params.page - 1) * EXECUTION_PER_PAGE,
  ...(params.status !== StatusType.Waiting && { status: params.status }),
  searchInput: params.input,
})

function ExecutionsList({
  executions,
  isLoading,
  isSearching,
}: ExecutionsListProps) {
  const hasExecutions = executions.length > 0

  if (isLoading) {
    return (
      <Center mt={8}>
        <PrimarySpinner fontSize="4xl" />
      </Center>
    )
  }

  if (!hasExecutions) {
    return (
      <NoResultFound
        description={
          isSearching ? "We couldn't find anything" : 'No executions yet'
        }
        action={
          isSearching
            ? 'Try using different keywords or checking for typos.'
            : 'Executions will appear here when your pipe has started running.'
        }
      />
    )
  }

  return (
    <>
      {executions.map((execution) => (
        <ExecutionRow key={execution.id} execution={execution} />
      ))}
    </>
  )
}

export default function Executions(): ReactElement {
  const { input, page, status, setSearchParams, isSearching } =
    usePaginationAndFilter()

  const { data, loading } = useQuery(GET_EXECUTIONS, {
    variables: getLimitAndOffset({
      page,
      status,
      input,
    }),
    fetchPolicy: 'cache-and-network',
    pollInterval: 5000,
  })

  const getExecutions = data?.getExecutions || {}
  const { pageInfo, edges } = getExecutions

  const executions: IExecution[] =
    edges?.map(({ node }: { node: IExecution }) => node) ?? []

  const hasNoUserExecutions = executions.length === 0 && !isSearching
  const hasPagination = !loading && pageInfo?.totalCount > EXECUTION_PER_PAGE

  return (
    <Container py={9}>
      <PageTitle
        title={EXECUTIONS_TITLE}
        searchComponent={
          !hasNoUserExecutions && (
            <SearchWithFilterInput
              searchValue={input}
              onChange={(input) => setSearchParams({ input })}
              status={status}
              onStatusChange={(status) => setSearchParams({ status })}
            />
          )
        }
      />

      <ExecutionsList
        executions={executions}
        isLoading={loading}
        isSearching={isSearching}
      />

      {hasPagination && (
        <Flex justifyContent="center" mt={6}>
          <Pagination
            currentPage={pageInfo?.currentPage}
            onPageChange={(page) => setSearchParams({ page })}
            pageSize={EXECUTION_PER_PAGE}
            totalCount={pageInfo?.totalCount}
          />
        </Flex>
      )}
    </Container>
  )
}
