import type { IExecution } from '@plumber/types'

import * as React from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useQuery } from '@apollo/client'
import Box from '@mui/material/Box'
import CircularProgress from '@mui/material/CircularProgress'
import Divider from '@mui/material/Divider'
import Grid from '@mui/material/Grid'
import Pagination from '@mui/material/Pagination'
import PaginationItem from '@mui/material/PaginationItem'
import Container from 'components/Container'
import ExecutionRow from 'components/ExecutionRow'
import ExecutionStatusMenu from 'components/ExecutionStatusMenu'
import NoResultFound from 'components/NoResultFound'
import PageTitle from 'components/PageTitle'
import { GET_EXECUTIONS } from 'graphql/queries/get-executions'
import useFormatMessage from 'hooks/useFormatMessage'

const EXECUTION_PER_PAGE = 10

const getLimitAndOffset = (page: number, filterStatus: string) => ({
  limit: EXECUTION_PER_PAGE,
  offset: (page - 1) * EXECUTION_PER_PAGE,
  status: filterStatus,
})

export default function Executions(): React.ReactElement {
  const formatMessage = useFormatMessage()
  const [searchParams, setSearchParams] = useSearchParams()
  const page = parseInt(searchParams.get('page') || '', 10) || 1

  const [filterStatus, setFilterStatus] = React.useState<string>(
    searchParams.get('status') || '',
  )
  const onFilterChange = (status: string) => {
    setFilterStatus(status)
    setSearchParams()
  }

  const { data, refetch, loading } = useQuery(GET_EXECUTIONS, {
    variables: getLimitAndOffset(page, filterStatus),
    fetchPolicy: 'cache-and-network',
    pollInterval: 5000,
  })
  const getExecutions = data?.getExecutions || {}
  const { pageInfo, edges } = getExecutions

  React.useEffect(() => {
    refetch(getLimitAndOffset(page, filterStatus.toLowerCase()))
  }, [refetch, page, filterStatus])

  const executions: IExecution[] = edges?.map(
    ({ node }: { node: IExecution }) => node,
  )
  const hasExecutions = executions?.length

  return (
    <Box sx={{ py: 3 }}>
      <Container variant="page">
        <Grid container sx={{ mb: [0, 3] }} columnSpacing={1.5} rowSpacing={3}>
          <Grid container item xs sm alignItems="center">
            <PageTitle>{formatMessage('executions.title')}</PageTitle>
          </Grid>
          <Grid item>
            <ExecutionStatusMenu
              filterStatus={filterStatus}
              onFilterChange={onFilterChange}
            ></ExecutionStatusMenu>
          </Grid>
        </Grid>

        <Divider sx={{ mt: [2, 0], mb: 2 }} />

        {loading && (
          <CircularProgress
            data-test="executions-loader"
            sx={{ display: 'block', margin: '20px auto' }}
          />
        )}

        {!loading && !hasExecutions && (
          <NoResultFound text={formatMessage('executions.noExecutions')} />
        )}

        {!loading &&
          executions?.map((execution) => (
            <ExecutionRow key={execution.id} execution={execution} />
          ))}

        {pageInfo && pageInfo.totalPages > 1 && (
          <Pagination
            sx={{ display: 'flex', justifyContent: 'center', mt: 3 }}
            page={pageInfo?.currentPage}
            count={pageInfo?.totalPages}
            onChange={(event, page) =>
              setSearchParams({ page: page.toString(), status: filterStatus })
            }
            renderItem={(item) => (
              <PaginationItem
                component={Link}
                to={`${
                  item.page === 1
                    ? ''
                    : `?page=${item.page}&status=${filterStatus}`
                }`}
                {...item}
              />
            )}
          />
        )}
      </Container>
    </Box>
  )
}
