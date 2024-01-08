import type { IFlow } from '@plumber/types'

import { forwardRef, useCallback, useMemo } from 'react'
import type { LinkProps } from 'react-router-dom'
import { Link, useSearchParams } from 'react-router-dom'
import { useQuery } from '@apollo/client'
import { Flex, Hide } from '@chakra-ui/react'
import AddIcon from '@mui/icons-material/Add'
import Box from '@mui/material/Box'
import CircularProgress from '@mui/material/CircularProgress'
import Divider from '@mui/material/Divider'
import Grid from '@mui/material/Grid'
import { Pagination } from '@opengovsg/design-system-react'
import ConditionalIconButton from 'components/ConditionalIconButton'
import Container from 'components/Container'
import EmptyFlowsTemplate from 'components/EmptyFlows'
import FlowRow from 'components/FlowRow'
import NavigationDrawer from 'components/Layout/NavigationDrawer'
import NoResultFound from 'components/NoResultFound'
import PageTitle from 'components/PageTitle'
import SearchInput from 'components/SearchInput'
import * as URLS from 'config/urls'
import { GET_FLOWS } from 'graphql/queries/get-flows'
import debounce from 'lodash/debounce'

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

  const CreateFlowLink = useMemo(
    () =>
      forwardRef<HTMLAnchorElement, Omit<LinkProps, 'to'>>(function InlineLink(
        linkProps,
        ref,
      ) {
        return <Link ref={ref} to={URLS.CREATE_FLOW} {...linkProps} />
      }),
    [],
  )

  if (!loading && !hasFlows && flowName === '' && page === 1) {
    return <EmptyFlowsTemplate CreateFlowLink={CreateFlowLink} />
  }

  return (
    <Box sx={{ py: 3 }}>
      <Container variant="page">
        <Grid
          container
          sx={{ mb: [0, 3] }}
          paddingLeft={[0, 4.5]}
          columnSpacing={1.5}
          rowSpacing={3}
        >
          <Grid container item xs sm alignItems="center" order={{ xs: 0 }}>
            <Hide above="sm">
              <NavigationDrawer />
            </Hide>
            <PageTitle title={FLOWS_TITLE} />
          </Grid>

          <Grid item xs={12} sm="auto" order={{ xs: 2, sm: 1 }}>
            <SearchInput
              searchValue={flowName}
              onChange={onSearchInputChange}
            />
          </Grid>

          <Grid
            container
            item
            xs="auto"
            sm="auto"
            alignItems="center"
            order={{ xs: 1, sm: 2 }}
          >
            <ConditionalIconButton
              type="submit"
              size="lg"
              component={CreateFlowLink}
              icon={<AddIcon />}
              data-test="create-flow-button"
            >
              Create Pipe
            </ConditionalIconButton>
          </Grid>
        </Grid>

        <Divider sx={{ mt: [2, 0], mb: 2 }} />

        {loading && (
          <CircularProgress sx={{ display: 'block', margin: '20px auto' }} />
        )}

        {!loading &&
          flows?.map((flow) => <FlowRow key={flow.id} flow={flow} />)}

        {!loading && !hasFlows && (
          <NoResultFound
            text="You don't have any pipes yet."
            to={URLS.CREATE_FLOW}
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
    </Box>
  )
}
