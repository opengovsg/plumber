import type { IExecution } from '@plumber/types'

import { ChangeEvent, ReactElement, useEffect, useRef, useState } from 'react'
import { BiSearch } from 'react-icons/bi'
import { useSearchParams } from 'react-router-dom'
import { useQuery } from '@apollo/client'
import {
  Box,
  CircularProgress,
  Divider,
  Flex,
  Icon,
  Input,
  InputGroup,
  InputLeftElement,
  InputRightElement,
} from '@chakra-ui/react'
import Pagination from '@mui/material/Pagination'
import Container from 'components/Container'
import ExecutionRow from 'components/ExecutionRow'
import ExecutionStatusMenu, { StatusType } from 'components/ExecutionStatusMenu'
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

const getLimitAndOffset = (params: ExecutionParameters) => ({
  limit: EXECUTION_PER_PAGE,
  offset: (params.page - 1) * EXECUTION_PER_PAGE,
  ...(params.status !== StatusType.Waiting && { status: params.status }),
  searchInput: params.input,
})

export default function Executions(): ReactElement {
  const formatMessage = useFormatMessage()
  const [searchParams, setSearchParams] = useSearchParams()
  const page = parseInt(searchParams.get('page') || '', 10) || 1

  const [searchInput, setSearchInput] = useState<string>(
    searchParams.get('input') || '',
  )
  const [filterStatus, setFilterStatus] = useState<string>(
    searchParams.get('status') || '',
  )

  const filterRef = useRef<HTMLDivElement>(null)
  const [inputPadding, setInputPadding] = useState<number>(0)

  // format search params for empty strings and first page
  const formatSearchParams = (params: Partial<ExecutionParameters>) => {
    setSearchParams({
      ...(params.page && params.page !== 1 && { page: params.page.toString() }),
      ...(params.status !== '' && { status: params.status }),
      ...(params.input !== '' && { input: params.input }),
    })
  }

  // search value handling
  const handleSearchInputChange = (input: string) => {
    formatSearchParams({ status: filterStatus, input })
    setSearchInput(input)
  }

  const handleSearchInputChangeDebounced = debounce(
    handleSearchInputChange,
    1000,
  )

  const onSearchInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    handleSearchInputChangeDebounced(event.target.value)
  }

  // filter status handling
  const onFilterChange = (status: string) => {
    setFilterStatus(status)
    formatSearchParams({ status, input: searchInput })
  }

  useEffect(() => {
    setFilterStatus(searchParams.get('status') || '')
  }, [searchParams])

  // update padding of input element when filter element width changes.
  useEffect(() => {
    if (!filterRef.current) {
      return
    }
    setInputPadding(filterRef.current.offsetWidth + 8)
  }, [filterStatus])

  const { data, loading } = useQuery(GET_EXECUTIONS, {
    variables: getLimitAndOffset({
      page,
      status: filterStatus,
      input: searchInput,
    }),
    fetchPolicy: 'cache-and-network',
    pollInterval: 5000,
  })

  const getExecutions = data?.getExecutions || {}
  const { pageInfo, edges } = getExecutions

  const executions: IExecution[] = edges?.map(
    ({ node }: { node: IExecution }) => node,
  )
  const hasExecutions = executions?.length

  return (
    <Box py={9}>
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
              pr={inputPadding}
              placeholder="Search by pipe name"
              defaultValue={searchInput}
              onChange={onSearchInputChange}
            ></Input>
            <InputRightElement w="fit-content" p={1} ref={filterRef}>
              <Divider
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

        <Divider borderColor="base.divider.medium" mb={4} />

        {loading && (
          <CircularProgress
            isIndeterminate
            color="primary.600"
            display="flex"
            justifyContent="center"
            my={5}
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
