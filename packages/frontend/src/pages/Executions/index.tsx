import type { IExecution } from '@plumber/types'

import {
  ChangeEvent,
  ReactElement,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { BiSearch } from 'react-icons/bi'
import { useSearchParams } from 'react-router-dom'
import { useQuery } from '@apollo/client'
import {
  Box,
  CircularProgress,
  Divider,
  Flex,
  Hide,
  Icon,
  Input,
  InputGroup,
  InputLeftElement,
  InputRightElement,
} from '@chakra-ui/react'
import { Pagination } from '@opengovsg/design-system-react'
import Container from 'components/Container'
import ExecutionRow from 'components/ExecutionRow'
import ExecutionStatusMenu, { StatusType } from 'components/ExecutionStatusMenu'
import NavigationDrawer from 'components/Layout/NavigationDrawer'
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

  const searchInput = searchParams.get('input') || ''
  const filterStatus = searchParams.get('status') || ''

  const filterRef = useRef<HTMLDivElement>(null)
  const [inputPadding, setInputPadding] = useState<number>(0)

  // format search params for empty strings and first page
  const formatSearchParams = useCallback(
    (params: Partial<ExecutionParameters>) => {
      setSearchParams({
        ...(params.page &&
          params.page !== 1 && { page: params.page.toString() }),
        ...(params.status !== '' && { status: params.status }),
        ...(params.input !== '' && { input: params.input }),
      })
    },
    [setSearchParams],
  )

  // page handling
  const handlePageChange = useCallback(
    (page: number) =>
      formatSearchParams({
        page,
        status: filterStatus,
        input: searchInput,
      }),
    [filterStatus, searchInput, formatSearchParams],
  )

  // search value handling
  const handleSearchInputChange = useCallback(
    (input: string) => {
      formatSearchParams({ status: filterStatus, input })
    },
    [filterStatus, formatSearchParams],
  )

  const handleSearchInputChangeDebounced = useMemo(
    () => debounce(handleSearchInputChange, 1000),
    [handleSearchInputChange],
  )

  const onSearchInputChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      handleSearchInputChangeDebounced(event.target.value)
    },
    [handleSearchInputChangeDebounced],
  )

  // filter status handling
  const onFilterChange = useCallback(
    (status: string) => {
      formatSearchParams({ status, input: searchInput })
    },
    [searchInput, formatSearchParams],
  )

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
          flexDir={{ base: 'column', md: 'row' }}
          justifyContent="space-between"
          alignItems={{ base: 'flex-start', md: 'center' }}
          gap={4}
          mb={8}
          pl={{ base: 0, sm: '1rem', md: '2rem' }}
        >
          <Flex alignItems="center">
            <Hide above="sm">
              <NavigationDrawer />
            </Hide>
            <PageTitle title={EXECUTIONS_TITLE} />
          </Flex>
          <InputGroup maxW="25rem">
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

        {!loading && pageInfo && pageInfo.totalCount > EXECUTION_PER_PAGE && (
          <Flex justifyContent="center" mt={6}>
            <Pagination
              currentPage={pageInfo?.currentPage}
              onPageChange={handlePageChange}
              pageSize={EXECUTION_PER_PAGE}
              totalCount={pageInfo?.totalCount}
            />
          </Flex>
        )}
      </Container>
    </Box>
  )
}
