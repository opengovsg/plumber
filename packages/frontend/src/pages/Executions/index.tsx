import type { IExecution, IFlow } from '@plumber/types'

import { ReactElement, useEffect, useMemo, useState } from 'react'
import { useQuery } from '@apollo/client'
import { Center, Flex } from '@chakra-ui/react'
import { Pagination } from '@opengovsg/design-system-react'
import * as yup from 'yup'

import Container from '@/components/Container'
import ExecutionRow from '@/components/ExecutionRow'
import { StatusType } from '@/components/ExecutionStatusMenu'
import NoResultFound from '@/components/NoResultFound'
import PageTitle from '@/components/PageTitle'
import PrimarySpinner from '@/components/PrimarySpinner'
import client from '@/graphql/client'
import { GET_EXECUTIONS } from '@/graphql/queries/get-executions'
import { GET_FLOWS } from '@/graphql/queries/get-flows'
import { usePaginationAndFilter } from '@/hooks/usePaginationAndFilter'

import SelectWithFilterInput from './components/SelectWithFilterInput'

const EXECUTIONS_PER_PAGE = 10
const EXECUTIONS_TITLE = 'Executions'

interface ExecutionParameters {
  page: number
  status: string
  flowId: string
}

interface ExecutionsListProps {
  executions: IExecution[]
  isSearching: boolean
  isLoading: boolean
}

const FLOW_LIMIT = 100
const FLOW_VARIABLES = {
  limit: FLOW_LIMIT,
  offset: 0,
  name: '',
}

const getLimitAndOffset = (params: ExecutionParameters) => ({
  limit: EXECUTIONS_PER_PAGE,
  offset: (params.page - 1) * EXECUTIONS_PER_PAGE,
  ...(params.status !== StatusType.Waiting && { status: params.status }),
  flowId: params.flowId,
})

/**
 * TODO: remove this after some time
 * This is a temporary fix to ensure that any execution failure emails
 * with flow name as input still works
 */
const checkValidUuid = (uuid: string) => {
  const schema = yup.string().uuid()
  return schema.isValidSync(uuid)
}

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
          isSearching
            ? 'No executions matching criteria'
            : 'Select a pipe to view executions'
        }
        action={
          isSearching
            ? 'Select a different pipe or change the status filter.'
            : ''
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

  const [allFlows, setAllFlows] = useState<IFlow[]>([])
  const [isLoadingFlows, setIsLoadingFlows] = useState(true)

  useEffect(() => {
    // Fetches all flows by paginating through results
    // First fetches initial page, then if there are more pages,
    // fetches remaining pages and combines results
    const fetchAllFlows = async () => {
      try {
        const { data } = await client.query({
          query: GET_FLOWS,
          variables: FLOW_VARIABLES,
        })

        const { edges, pageInfo } = data.getFlows || {}
        const totalCount = pageInfo.totalCount
        let allFlowsData = edges.map(({ node }: { node: IFlow }) => node)

        const remainingPages = Math.ceil(totalCount / FLOW_LIMIT) - 1
        if (remainingPages > 0) {
          const pageNumbers = [...Array(remainingPages)].map((_, i) => i + 1)
          const remainingQueries = pageNumbers.map((pageNum) =>
            client.query({
              query: GET_FLOWS,
              variables: {
                ...FLOW_VARIABLES,
                offset: pageNum * FLOW_LIMIT,
              },
            }),
          )

          const results = await Promise.all(remainingQueries)
          const additionalFlows = results.flatMap((result) =>
            result.data.getFlows.edges.map(({ node }: { node: IFlow }) => node),
          )
          allFlowsData = [...allFlowsData, ...additionalFlows]
        }

        setAllFlows(allFlowsData)
      } finally {
        setIsLoadingFlows(false)
      }
    }

    fetchAllFlows()
  }, [])

  const flows = useMemo(() => allFlows, [allFlows])
  const items = useMemo(
    () =>
      flows.map((flow) => ({
        value: flow.id,
        label: flow.name,
      })),
    [flows],
  )

  /**
   * TODO: remove this after some time
   * This is a temporary fix to ensure that any execution failure emails
   * with flow name as input still works
   */
  const searchInput = useMemo(() => {
    if (checkValidUuid(input)) {
      return input
    } else {
      const newInput = flows.find((flow) => flow.name === input)?.id
      setSearchParams({ input: newInput })
      return newInput
    }
  }, [input, flows, setSearchParams])

  const { data, loading } = useQuery(GET_EXECUTIONS, {
    variables: getLimitAndOffset({
      page,
      status,
      flowId: searchInput ?? '',
    }),
    fetchPolicy: 'cache-and-network',
    skip: !searchInput,
  })

  const getExecutions = data?.getExecutions || {}
  const { pageInfo, edges } = getExecutions

  const executions: IExecution[] =
    edges?.map(({ node }: { node: IExecution }) => node) ?? []

  const totalCount: number = pageInfo?.totalCount ?? 0
  const hasPagination = !loading && totalCount > EXECUTIONS_PER_PAGE

  // ensure invalid pages won't be accessed even after deleting executions
  const lastPage = Math.ceil(totalCount / EXECUTIONS_PER_PAGE)
  useEffect(() => {
    // Defer the search params update till after the initial render
    if (lastPage !== 0 && page > lastPage) {
      setSearchParams({ page: lastPage })
    }
  }, [lastPage, page, setSearchParams])

  return (
    <Container py={9}>
      <PageTitle
        title={EXECUTIONS_TITLE}
        searchComponent={
          <SelectWithFilterInput
            searchValue={searchInput}
            onChange={(input) => setSearchParams({ input })}
            status={status}
            onStatusChange={(status) => setSearchParams({ status })}
            items={items}
            loading={isLoadingFlows}
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
            pageSize={EXECUTIONS_PER_PAGE}
            totalCount={totalCount}
          />
        </Flex>
      )}
    </Container>
  )
}
