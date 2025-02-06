import { IFlow } from '@plumber/types'

import { ReactElement, useMemo } from 'react'
import { useQuery } from '@apollo/client'

import { GET_FLOWS } from '@/graphql/queries/get-flows'
import { usePaginationAndFilter } from '@/hooks/usePaginationAndFilter'

import ExecutionListPage from './components/ExecutionListPage'
import FlowListPage from './components/FlowListPage'

const RESULTS_PER_PAGE = 10

const getLimitAndOffset = (page: number) => ({
  limit: RESULTS_PER_PAGE,
  offset: (page - 1) * RESULTS_PER_PAGE,
})

export default function Executions(): ReactElement {
  const { searchParams, input, page } = usePaginationAndFilter()
  const flowId = searchParams.get('pipeId') || ''

  const { data, loading } = useQuery(GET_FLOWS, {
    variables: {
      ...getLimitAndOffset(page),
      name: input,
    },
  })

  const { pageInfo, edges } = data?.getFlows || {}
  const flows: IFlow[] = useMemo(
    () => edges?.map(({ node }: { node: IFlow }) => node) ?? [],
    [edges],
  )

  const flow = flows.find((flow) => flow.id === flowId)

  if (flowId && flow) {
    return <ExecutionListPage flow={flow} />
  }

  return <FlowListPage loading={loading} flows={flows} pageInfo={pageInfo} />
}
