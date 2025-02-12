import type { IExecution } from '@plumber/types'

import { useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery } from '@apollo/client'
import { Center, Flex } from '@chakra-ui/react'
import { Pagination } from '@opengovsg/design-system-react'

import Container from '@/components/Container'
import ExecutionRow from '@/components/ExecutionRow'
import NoResultFound from '@/components/NoResultFound'
import PageTitle from '@/components/PageTitle'
import PrimarySpinner from '@/components/PrimarySpinner'
import { GET_EXECUTIONS } from '@/graphql/queries/get-executions'
import { GET_FLOW } from '@/graphql/queries/get-flow'
import { usePaginationAndFilter } from '@/hooks/usePaginationAndFilter'

import StatusInput from './components/StatusInput'

const RESULTS_PER_PAGE = 10

interface ExecutionsListProps {
  executions: IExecution[]
  isSearching: boolean
  isLoading: boolean
  page: number
}

const getLimitAndOffset = (page: number) => ({
  limit: RESULTS_PER_PAGE,
  offset: (page - 1) * RESULTS_PER_PAGE,
})

type ExecutionsForFlowParams = {
  flowId: string
}

function ExecutionsList({
  executions,
  isLoading,
  isSearching,
  page,
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
        <ExecutionRow key={execution.id} execution={execution} page={page} />
      ))}
    </>
  )
}

export default function ExecutionsForFlowPage() {
  const { flowId } = useParams() as ExecutionsForFlowParams

  const { page, setSearchParams, status, isSearching } =
    usePaginationAndFilter()

  const { data: flowData, loading: isFlowLoading } = useQuery(GET_FLOW, {
    variables: { id: flowId },
    skip: !flowId,
  })

  const { data: executionsData, loading: isExecutionsLoading } = useQuery(
    GET_EXECUTIONS,
    {
      variables: {
        ...getLimitAndOffset(page),
        status,
        flowId,
      },
      skip: !flowId,
    },
  )

  const { pageInfo, edges } = executionsData?.getExecutions || {}
  const executions: IExecution[] =
    edges?.map(({ node }: { node: IExecution }) => {
      return {
        ...node,
        flow: flowData?.getFlow,
      }
    }) ?? []
  const totalCount: number = pageInfo?.totalCount ?? 0
  const isLoading = isExecutionsLoading || isFlowLoading
  const hasPagination = !isLoading && totalCount > RESULTS_PER_PAGE

  // ensure invalid pages won't be accessed even after deleting flows
  const lastPage = Math.ceil(totalCount / RESULTS_PER_PAGE)

  useEffect(() => {
    // Defer the search params update till after the initial render
    if (lastPage !== 0 && page > lastPage) {
      setSearchParams({ page: lastPage })
    }
  }, [lastPage, page, setSearchParams])

  if (isLoading) {
    return (
      <Center mt={8}>
        <PrimarySpinner fontSize="4xl" />
      </Center>
    )
  }

  if (!flowData?.getFlow) {
    return <NoResultFound description="Flow not found" />
  }

  const { name: flowName } = flowData.getFlow

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
        isLoading={isLoading}
        isSearching={isSearching}
        page={page}
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
