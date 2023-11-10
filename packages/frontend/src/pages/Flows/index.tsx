import type { IFlow } from '@plumber/types'

import * as React from 'react'
import type { LinkProps } from 'react-router-dom'
import { Link, useSearchParams } from 'react-router-dom'
import { useLazyQuery } from '@apollo/client'
import AddIcon from '@mui/icons-material/Add'
import Box from '@mui/material/Box'
import CircularProgress from '@mui/material/CircularProgress'
import Divider from '@mui/material/Divider'
import Grid from '@mui/material/Grid'
import Pagination from '@mui/material/Pagination'
import ConditionalIconButton from 'components/ConditionalIconButton'
import Container from 'components/Container'
import FlowRow from 'components/FlowRow'
import NoResultFound from 'components/NoResultFound'
import PageTitle from 'components/PageTitle'
import SearchInput from 'components/SearchInput'
import * as URLS from 'config/urls'
import { GET_FLOWS } from 'graphql/queries/get-flows'
import useFormatMessage from 'hooks/useFormatMessage'
import debounce from 'lodash/debounce'

const FLOW_PER_PAGE = 10
const FLOWS_TITLE = 'Pipes'

const getLimitAndOffset = (page: number) => ({
  limit: FLOW_PER_PAGE,
  offset: (page - 1) * FLOW_PER_PAGE,
})

export default function Flows(): React.ReactElement {
  const formatMessage = useFormatMessage()
  const [searchParams, setSearchParams] = useSearchParams()
  const page = parseInt(searchParams.get('page') || '', 10) || 1
  const [flowName, setFlowName] = React.useState('')
  const [loading, setLoading] = React.useState(false)
  const [getFlows, { data }] = useLazyQuery(GET_FLOWS, {
    onCompleted: () => {
      setLoading(false)
    },
  })

  const fetchData = React.useMemo(
    () =>
      debounce(
        (name) =>
          getFlows({
            variables: {
              ...getLimitAndOffset(page),
              name,
            },
          }),
        300,
      ),
    [page, getFlows],
  )

  React.useEffect(
    function fetchFlowsOnSearch() {
      setLoading(true)

      fetchData(flowName)
    },
    [fetchData, flowName],
  )

  // setSearchParams is "unstable": updates whenever searchParams change
  const setSearchParamsRef = React.useRef(setSearchParams)
  const stableSetSearchParams = React.useCallback(
    (...args: Parameters<typeof setSearchParams>) =>
      setSearchParamsRef.current(...args),
    [],
  )

  React.useEffect(
    // reset search params which only consists of `page`
    () => stableSetSearchParams({}),
    [flowName, stableSetSearchParams],
  )

  React.useEffect(
    function cancelDebounceOnUnmount() {
      return () => {
        fetchData.cancel()
      }
    },
    [fetchData],
  )

  const { pageInfo, edges } = data?.getFlows || {}

  const flows: IFlow[] = edges?.map(({ node }: { node: IFlow }) => node)
  const hasFlows = flows?.length

  const onSearchChange = React.useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      setFlowName(event.target.value)
    },
    [],
  )

  const CreateFlowLink = React.useMemo(
    () =>
      React.forwardRef<HTMLAnchorElement, Omit<LinkProps, 'to'>>(
        function InlineLink(linkProps, ref) {
          return <Link ref={ref} to={URLS.CREATE_FLOW} {...linkProps} />
        },
      ),
    [],
  )

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
            <PageTitle title={FLOWS_TITLE} />
          </Grid>

          <Grid item xs={12} sm="auto" order={{ xs: 2, sm: 1 }}>
            <SearchInput onChange={onSearchChange} />
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
              {formatMessage('flows.create')}
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
            text={formatMessage('flows.noFlows')}
            to={URLS.CREATE_FLOW}
          />
        )}

        {!loading && pageInfo && pageInfo.totalPages > 1 && (
          <Pagination
            sx={{ display: 'flex', justifyContent: 'center', mt: 3 }}
            page={pageInfo?.currentPage}
            count={pageInfo?.totalPages}
            onChange={(event, page) =>
              stableSetSearchParams({ page: page.toString() })
            }
          />
        )}
      </Container>
    </Box>
  )
}
