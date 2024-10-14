import type { IFlow } from '@plumber/types'

import { useQuery } from '@apollo/client'
import { Box, Center, Flex, useDisclosure } from '@chakra-ui/react'
import { Button, Pagination } from '@opengovsg/design-system-react'

import Container from '@/components/Container'
import DebouncedSearchInput from '@/components/DebouncedSearchInput'
import FlowRow from '@/components/FlowRow'
import NoResultFound from '@/components/NoResultFound'
import PageTitle from '@/components/PageTitle'
import PrimarySpinner from '@/components/PrimarySpinner'
import { GET_FLOWS } from '@/graphql/queries/get-flows'
import { usePaginationAndFilter } from '@/hooks/usePaginationAndFilter'

import ApproveTransfersInfobox from './components/ApproveTransfersInfobox'
import CreateFlowModal from './components/CreateFlowModal'
import EmptyFlows from './components/EmptyFlows'

const FLOW_PER_PAGE = 10
const FLOWS_TITLE = 'Pipes'

interface FlowsInternalProps {
  isLoading: boolean
  isSearching: boolean
  flows: IFlow[]
  onCreateModalOpen: () => void
}

const getLimitAndOffset = (page: number) => ({
  limit: FLOW_PER_PAGE,
  offset: (page - 1) * FLOW_PER_PAGE,
})

function FlowsList({
  isLoading,
  isSearching,
  flows,
  onCreateModalOpen,
}: FlowsInternalProps) {
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
    return <EmptyFlows onCreate={onCreateModalOpen} />
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
        <FlowRow key={flow.id} flow={flow} />
      ))}
    </Box>
  )
}

export default function Flows(): React.ReactElement {
  const { input, page, setSearchParams, isSearching } = usePaginationAndFilter()
  const { isOpen, onOpen, onClose } = useDisclosure()

  const { data, loading } = useQuery(GET_FLOWS, {
    variables: {
      ...getLimitAndOffset(page),
      name: input,
    },
  })

  const { pageInfo, edges } = data?.getFlows || {}
  const flows: IFlow[] = edges?.map(({ node }: { node: IFlow }) => node) ?? []
  const hasPagination =
    !loading && pageInfo && pageInfo.totalCount > FLOW_PER_PAGE
  const hasNoUserFlows = flows.length === 0 && !isSearching

  return (
    <Container py={9}>
      {!hasNoUserFlows && (
        <PageTitle
          title={FLOWS_TITLE}
          searchComponent={
            <DebouncedSearchInput
              searchValue={input}
              onChange={(input) => setSearchParams({ input })}
            />
          }
          createComponent={
            <Button data-test="create-flow-button" onClick={onOpen}>
              Create Pipe
            </Button>
          }
        />
      )}

      <ApproveTransfersInfobox />

      <FlowsList
        flows={flows}
        isLoading={loading}
        isSearching={isSearching}
        onCreateModalOpen={onOpen}
      />

      {hasPagination && (
        <Flex justifyContent="center" mt={6}>
          <Pagination
            currentPage={pageInfo?.currentPage}
            onPageChange={(page) => setSearchParams({ page })}
            pageSize={FLOW_PER_PAGE}
            totalCount={pageInfo?.totalCount}
          />
        </Flex>
      )}
      {isOpen && <CreateFlowModal onClose={onClose} />}
    </Container>
  )
}
