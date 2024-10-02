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

const getLimitAndOffset = (page: number) => ({
  limit: FLOW_PER_PAGE,
  offset: (page - 1) * FLOW_PER_PAGE,
})

export default function Flows(): React.ReactElement {
  const { input, page, setSearchParams } = usePaginationAndFilter()

  // modal for creation of flows
  const { isOpen, onOpen, onClose } = useDisclosure()

  const { data, loading } = useQuery(GET_FLOWS, {
    variables: {
      ...getLimitAndOffset(page),
      name: input,
    },
  })

  const { pageInfo, edges } = data?.getFlows || {}
  const flows: IFlow[] = edges?.map(({ node }: { node: IFlow }) => node)
  const hasFlows = flows?.length > 0
  const isSearching = input !== '' || page !== 1

  const isEmptyState = !hasFlows && !isSearching
  const isEmptySearchResults = !loading && !hasFlows && isSearching
  const hasPagination = pageInfo && pageInfo.totalCount > FLOW_PER_PAGE

  return (
    <>
      <Container py={9} overflowY={'hidden'}>
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

        <ApproveTransfersInfobox />

        {loading && (
          <Center mt={8}>
            <PrimarySpinner fontSize="4xl" />
          </Center>
        )}

        {!loading && isEmptyState && <EmptyFlows onCreate={onOpen} />}

        {!loading && (
          <Box>
            {flows?.map((flow) => (
              <FlowRow key={flow.id} flow={flow} />
            ))}
          </Box>
        )}

        {isEmptySearchResults && (
          <NoResultFound
            description="We couldn't find anything"
            action="Try using different keywords or checking for typos."
          />
        )}

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
      </Container>

      {isOpen && <CreateFlowModal onClose={onClose} />}
    </>
  )
}
