import type { IExecution, IFlow } from '@plumber/types'

import { useQuery } from '@apollo/client'
import { Center, Flex } from '@chakra-ui/react'
import { Pagination } from '@opengovsg/design-system-react'

import Container from '@/components/Container'
import ExecutionRow from '@/components/ExecutionRow'
import NoResultFound from '@/components/NoResultFound'
import PageTitle from '@/components/PageTitle'
import PrimarySpinner from '@/components/PrimarySpinner'
import { GET_EXECUTIONS } from '@/graphql/queries/get-executions'
import { usePaginationAndFilter } from '@/hooks/usePaginationAndFilter'

import StatusInput from './StatusInput'

const RESULTS_PER_PAGE = 10

interface ExecutionsListProps {
  executions: IExecution[]
  isSearching: boolean
  isLoading: boolean
}

const getLimitAndOffset = (page: number) => ({
  limit: RESULTS_PER_PAGE,
  offset: (page - 1) * RESULTS_PER_PAGE,
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
          isSearching ? 'No executions matching status' : 'No executions yet'
        }
        action={
          isSearching
            ? 'Select a different status.'
            : 'Executions will appear here when the pipe runs.'
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

export default function ExecutionList({ flow }: { flow: IFlow }) {
  const { page, setSearchParams, status, isSearching } =
    usePaginationAndFilter()
  const { id: flowId, name: flowName } = flow
  const { data: executionsData, loading } = useQuery(GET_EXECUTIONS, {
    variables: {
      ...getLimitAndOffset(page),
      status,
      flowId,
    },
    fetchPolicy: 'cache-and-network',
    skip: !flowId,
  })

  const { pageInfo, edges } = executionsData?.getExecutions || {}
  const executions: IExecution[] =
    edges?.map(({ node }: { node: IExecution }) => {
      return {
        ...node,
        flow,
      }
    }) ?? []
  const totalCount: number = pageInfo?.totalCount ?? 0
  const hasPagination = !loading && totalCount > RESULTS_PER_PAGE
  return (
    <Container py={9}>
      <PageTitle
        title={`Executions for ${flowName}`}
        searchComponent={
          <StatusInput
            status={status}
            onStatusChange={(newStatus) => {
              setSearchParams({ status: newStatus })
            }}
          />
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
            pageSize={RESULTS_PER_PAGE}
            totalCount={totalCount}
          />
        </Flex>
      )}
    </Container>
  )
}
