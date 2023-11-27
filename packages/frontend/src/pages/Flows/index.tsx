import type { IFlow } from '@plumber/types'

import { forwardRef, useEffect, useMemo, useState } from 'react'
import type { LinkProps } from 'react-router-dom'
import { Link, useSearchParams } from 'react-router-dom'
import { useQuery } from '@apollo/client'
import { Hide } from '@chakra-ui/react'
import AddIcon from '@mui/icons-material/Add'
import Box from '@mui/material/Box'
import CircularProgress from '@mui/material/CircularProgress'
import Divider from '@mui/material/Divider'
import Grid from '@mui/material/Grid'
import Pagination from '@mui/material/Pagination'
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

const getLimitAndOffset = (page: number) => ({
  limit: FLOW_PER_PAGE,
  offset: (page - 1) * FLOW_PER_PAGE,
})

export default function Flows(): React.ReactElement {
  const [searchParams, setSearchParams] = useSearchParams()
  const page = parseInt(searchParams.get('page') || '', 10) || 1

  const [flowName, setFlowName] = useState('')
  const onFlowSearchChange = useMemo(
    () =>
      debounce((event: React.ChangeEvent<HTMLInputElement>) => {
        setFlowName(event.target.value)
        setSearchParams({})
      }, 300),
    [setFlowName, setSearchParams],
  )
  useEffect(() => {
    return () => {
      onFlowSearchChange.cancel()
    }
  }, [onFlowSearchChange])

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

  if (loading) {
    return <CircularProgress sx={{ display: 'block', margin: '20px auto' }} />
  }

  if (!hasFlows && flowName === '') {
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
            <SearchInput onChange={onFlowSearchChange} />
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

        {!loading &&
          flows?.map((flow) => <FlowRow key={flow.id} flow={flow} />)}

        {!loading && !hasFlows && (
          <NoResultFound
            text="You don't have any pipes yet."
            to={URLS.CREATE_FLOW}
          />
        )}

        {!loading && pageInfo && pageInfo.totalPages > 1 && (
          <Pagination
            sx={{ display: 'flex', justifyContent: 'center', mt: 3 }}
            page={pageInfo?.currentPage}
            count={pageInfo?.totalPages}
            onChange={(_event, page) =>
              setSearchParams(page === 1 ? {} : { page: page.toString() })
            }
          />
        )}
      </Container>
    </Box>
  )
}
