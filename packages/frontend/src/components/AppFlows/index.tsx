import type { IFlow } from '@plumber/types'

import { useSearchParams } from 'react-router-dom'
import { useQuery } from '@apollo/client'
import { Flex } from '@chakra-ui/react'
import { Pagination } from '@opengovsg/design-system-react'

import AppFlowRow from '@/components/FlowRow'
import NoResultFound from '@/components/NoResultFound'
import { GET_FLOWS } from '@/graphql/queries/get-flows'

type AppFlowsProps = {
  appKey: string
}

const FLOW_PER_PAGE = 10

const getLimitAndOffset = (page: number) => ({
  limit: FLOW_PER_PAGE,
  offset: (page - 1) * FLOW_PER_PAGE,
})

export default function AppFlows(props: AppFlowsProps): React.ReactElement {
  const { appKey } = props
  const [searchParams, setSearchParams] = useSearchParams()
  const connectionId = searchParams.get('connectionId') || undefined
  const page = parseInt(searchParams.get('page') || '', 10) || 1
  const { data } = useQuery(GET_FLOWS, {
    variables: {
      appKey,
      connectionId,
      ...getLimitAndOffset(page),
    },
  })
  const getFlows = data?.getFlows || {}
  const { pageInfo, edges } = getFlows

  const flows: IFlow[] = edges?.map(({ node }: { node: IFlow }) => node)
  const hasFlows = flows?.length

  if (!hasFlows) {
    return (
      <NoResultFound
        description="No pipes found"
        action="Go to your pipes to create one"
      />
    )
  }

  return (
    <>
      {flows?.map((appFlow: IFlow) => (
        <AppFlowRow key={appFlow.id} flow={appFlow} />
      ))}

      {pageInfo && pageInfo.totalCount > FLOW_PER_PAGE && (
        <Flex justifyContent="center" mt={6}>
          <Pagination
            currentPage={pageInfo?.currentPage}
            onPageChange={(page) =>
              setSearchParams(page === 1 ? {} : { page: page.toString() })
            }
            pageSize={FLOW_PER_PAGE}
            totalCount={pageInfo?.totalCount}
          />
        </Flex>
      )}
    </>
  )
}
