import type { IFlow } from '@plumber/types'

import { useCallback, useMemo } from 'react'
import { BiPlus } from 'react-icons/bi'
import { useSearchParams } from 'react-router-dom'
import { useQuery } from '@apollo/client'
import { Center, Flex, Grid, GridItem, useDisclosure } from '@chakra-ui/react'
import { Pagination } from '@opengovsg/design-system-react'
import debounce from 'lodash/debounce'

import ConditionalIconButton from '@/components/ConditionalIconButton'
import Container from '@/components/Container'
import FlowRow from '@/components/FlowRow'
import NoResultFound from '@/components/NoResultFound'
import PageTitle from '@/components/PageTitle'
import PrimarySpinner from '@/components/PrimarySpinner'
import SearchInput from '@/components/SearchInput'
import { GET_FLOWS } from '@/graphql/queries/get-flows'

import ApproveTransfersInfobox from './components/ApproveTransfersInfobox'
import CreateFlowModal from './components/CreateFlowModal'
import EmptyFlows from './components/EmptyFlows'

const FLOW_PER_PAGE = 10
const FLOWS_TITLE = 'Pipes'

interface FlowsParameters {
  page: number
  input: string
}

const getLimitAndOffset = (page: number) => ({
  limit: FLOW_PER_PAGE,
  offset: (page - 1) * FLOW_PER_PAGE,
})

export default function Flows(): React.ReactElement {
  const [searchParams, setSearchParams] = useSearchParams()
  const page = parseInt(searchParams.get('page') || '', 10) || 1
  const flowName = searchParams.get('input') || ''

  // modal for creation of flows
  const { isOpen, onOpen, onClose } = useDisclosure()

  // format search params for empty string input and first page
  const formatSearchParams = useCallback(
    (params: Partial<FlowsParameters>) => {
      setSearchParams({
        ...(params.page &&
          params.page != 1 && { page: params.page.toString() }),
        ...(params.input != '' && { input: params.input }),
      })
    },
    [setSearchParams],
  )

  const handlePageChange = useCallback(
    (page: number) => {
      formatSearchParams({
        page,
        input: flowName,
      })
    },
    [flowName, formatSearchParams],
  )

  // handle and debounce input
  const handleSearchInputChange = useCallback(
    (input: string) => {
      formatSearchParams({ input })
    },
    [formatSearchParams],
  )

  const handleSearchInputChangeDebounced = useMemo(
    () => debounce(handleSearchInputChange, 1000),
    [handleSearchInputChange],
  )

  const onSearchInputChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      handleSearchInputChangeDebounced(event.target.value)
    },
    [handleSearchInputChangeDebounced],
  )

  const { data, loading } = useQuery(GET_FLOWS, {
    variables: {
      ...getLimitAndOffset(page),
      name: flowName,
    },
  })

  const { pageInfo, edges } = data?.getFlows || {}
  const flows: IFlow[] = edges?.map(({ node }: { node: IFlow }) => node)
  const hasFlows = flows?.length

  // TODO (mal): think of a way to make this less complicated
  if (!loading && !hasFlows && flowName === '' && page === 1) {
    return (
      <Container py={9}>
        <ApproveTransfersInfobox />
        <EmptyFlows />
      </Container>
    )
  }

  return (
    <>
      <Container py={9}>
        <Grid
          templateAreas={{
            base: `
              "title button"
              "search search"
            `,
            md: `"title search button"`,
          }}
          gridTemplateColumns={{ base: '1fr auto', md: '2fr 1fr auto' }}
          columnGap={3}
          rowGap={5}
          alignItems="center"
          pl={{ base: '0', md: '2rem' }}
          mb={6}
        >
          <GridItem area="title">
            <PageTitle title={FLOWS_TITLE} />
          </GridItem>

          <GridItem area="search">
            <SearchInput
              searchValue={flowName}
              onChange={onSearchInputChange}
            />
          </GridItem>

          <GridItem area="button">
            <ConditionalIconButton
              type="submit"
              size="lg"
              icon={<BiPlus />}
              data-test="create-flow-button"
              onClick={onOpen}
            >
              Create Pipe
            </ConditionalIconButton>
          </GridItem>
        </Grid>

        <ApproveTransfersInfobox />

        {loading && (
          <Center mt={8}>
            <PrimarySpinner fontSize="4xl" />
          </Center>
        )}

        {!loading &&
          flows?.map((flow) => <FlowRow key={flow.id} flow={flow} />)}

        {!loading && !hasFlows && (
          <NoResultFound
            description="We couldn't find anything"
            action="Try using different keywords or checking for typos."
          />
        )}

        {!loading && pageInfo && pageInfo.totalCount > FLOW_PER_PAGE && (
          <Flex justifyContent="center" mt={6}>
            <Pagination
              currentPage={pageInfo?.currentPage}
              onPageChange={handlePageChange}
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
