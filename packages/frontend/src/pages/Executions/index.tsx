import type { IExecution } from '@plumber/types'

import * as React from 'react'
import { useCallback, useMemo } from 'react'
import { BiSearch } from 'react-icons/bi'
import { useSearchParams } from 'react-router-dom'
import { useQuery } from '@apollo/client'
import {
  Divider as ChakraDivider,
  Flex,
  Icon,
  Input,
  InputGroup,
  InputLeftElement,
  InputRightElement,
} from '@chakra-ui/react'
import Box from '@mui/material/Box'
import CircularProgress from '@mui/material/CircularProgress'
import Divider from '@mui/material/Divider'
import Pagination from '@mui/material/Pagination'
import Container from 'components/Container'
import ExecutionRow from 'components/ExecutionRow'
import ExecutionStatusMenu from 'components/ExecutionStatusMenu'
import NoResultFound from 'components/NoResultFound'
import PageTitle from 'components/PageTitle'
import { GET_EXECUTIONS } from 'graphql/queries/get-executions'
import useFormatMessage from 'hooks/useFormatMessage'
import debounce from 'lodash/debounce'

const EXECUTION_PER_PAGE = 10
const EXECUTIONS_TITLE = 'Executions'

interface ExecutionParameters {
  page: number
  status: string
  input: string
}

const getLimitAndOffset = (
  page: number,
  filterStatus: string,
  searchInput: string,
) => ({
  limit: EXECUTION_PER_PAGE,
  offset: (page - 1) * EXECUTION_PER_PAGE,
  status: filterStatus,
  searchInput: searchInput,
})

export default function Executions(): React.ReactElement {
  const formatMessage = useFormatMessage()
  const [searchParams, setSearchParams] = useSearchParams()
  const page = parseInt(searchParams.get('page') || '', 10) || 1

  const [searchInput, setSearchInput] = React.useState<string>(
    searchParams.get('input') || '',
  )
  const [filterStatus, setFilterStatus] = React.useState<string>(
    searchParams.get('status') || '',
  )

  // format search params for empty strings and first page
  const formatSearchParams = (params: Partial<ExecutionParameters>) => {
    setSearchParams({
      ...(params.page && params.page !== 1 && { page: params.page.toString() }),
      ...(params.status !== '' && { status: params.status }),
      ...(params.input !== '' && { input: params.input }),
    })
  }

  // search value handling
  const handleSearchInputChange = useCallback(
    (input: string) => {
      formatSearchParams({ status: filterStatus, input })
      setSearchInput(input)
    },
    [searchInput],
  )

  const handleSearchInputChangeDebounced = useMemo(
    () => debounce(handleSearchInputChange, 500),
    [handleSearchInputChange],
  )

  const onSearchInputChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      handleSearchInputChangeDebounced(event.target.value)
    },
    [handleSearchInputChangeDebounced],
  )

  // filter status handling
  const onFilterChange = (status: string) => {
    setFilterStatus(status)
    formatSearchParams({ status, input: searchInput })
  }

  React.useEffect(() => {
    setFilterStatus(searchParams.get('status') || '')
  }, [searchParams])

  const { data, loading } = useQuery(GET_EXECUTIONS, {
    variables: getLimitAndOffset(page, filterStatus, searchInput),
    fetchPolicy: 'cache-and-network',
    pollInterval: 5000,
  })

  // React.useEffect(() => {
  //   refetch(getLimitAndOffset(page, filterStatus.toLowerCase(), searchInput))
  // }, [refetch, page, filterStatus, searchInput])

  const getExecutions = data?.getExecutions || {}
  const { pageInfo, edges } = getExecutions

  const executions: IExecution[] = edges?.map(
    ({ node }: { node: IExecution }) => node,
  )
  const hasExecutions = executions?.length

  return (
    <Box sx={{ py: 3 }}>
      <Container variant="page">
        <Flex
          flexDir={{ base: 'column', sm: 'row' }}
          justifyContent="space-between"
          alignItems="center"
          gap={4}
          mb={8}
        >
          <PageTitle title={EXECUTIONS_TITLE} />
          <InputGroup w="25rem">
            <InputLeftElement>
              <Icon as={BiSearch} boxSize={5} />
            </InputLeftElement>
            <Input
              textStyle="body-1"
              pr="7.5rem"
              placeholder="Search by pipe name"
              defaultValue={searchInput}
              onChange={onSearchInputChange}
            ></Input>
            <InputRightElement w="fit-content" p={1}>
              <ChakraDivider
                borderColor="base.divider.medium"
                h={5}
                mr={1}
                orientation="vertical"
              />
              <ExecutionStatusMenu
                filterStatus={filterStatus}
                onFilterChange={onFilterChange}
              ></ExecutionStatusMenu>
            </InputRightElement>
          </InputGroup>
        </Flex>

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

        {!loading && pageInfo && pageInfo.totalPages > 1 && (
          <Pagination
            sx={{ display: 'flex', justifyContent: 'center', mt: 3 }}
            page={pageInfo?.currentPage}
            count={pageInfo?.totalPages}
            onChange={(event, page) => {
              formatSearchParams({
                page,
                status: filterStatus,
                input: searchInput,
              })
            }}
          />
        )}
      </Container>
    </Box>
  )
}
