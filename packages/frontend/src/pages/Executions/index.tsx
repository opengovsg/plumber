import type { IExecution } from '@plumber/types'

import {
  ReactElement,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { BiSearch } from 'react-icons/bi'
import { useQuery } from '@apollo/client'
import {
  Center,
  Divider,
  Flex,
  Icon,
  Input,
  InputGroup,
  InputLeftElement,
  InputRightElement,
} from '@chakra-ui/react'
import { Pagination } from '@opengovsg/design-system-react'
import { debounce } from 'lodash'

import Container from '@/components/Container'
import ExecutionRow from '@/components/ExecutionRow'
import ExecutionStatusMenu, {
  StatusType,
} from '@/components/ExecutionStatusMenu'
import NoResultFound from '@/components/NoResultFound'
import PageTitle from '@/components/PageTitle'
import PrimarySpinner from '@/components/PrimarySpinner'
import { GET_EXECUTIONS } from '@/graphql/queries/get-executions'
import { usePaginationAndFilter } from '@/hooks/usePaginationAndFilter'

const EXECUTION_PER_PAGE = 10
const EXECUTIONS_TITLE = 'Executions'

interface ExecutionParameters {
  page: number
  status: string
  input: string
}

interface ExecutionsListProps {
  executions: IExecution[]
  isSearching: boolean
  isLoading: boolean
}

const getLimitAndOffset = (params: ExecutionParameters) => ({
  limit: EXECUTION_PER_PAGE,
  offset: (params.page - 1) * EXECUTION_PER_PAGE,
  ...(params.status !== StatusType.Waiting && { status: params.status }),
  searchInput: params.input,
})

function ExecutionsList({
  executions,
  isLoading,
  isSearching,
}: ExecutionsListProps) {
  const hasExecutions = executions.length > 0

  if (isLoading) {
    return (
      <Center mt={8}>
        <PrimarySpinner fontSize="4xl" />
      </Center>
    )
  }

  if (!hasExecutions) {
    return (
      <NoResultFound
        description={
          isSearching ? "We couldn't find anything" : 'No executions yet'
        }
        action={
          isSearching
            ? 'Try using different keywords or checking for typos.'
            : 'Executions will appear here when your pipe has started running.'
        }
      />
    )
  }

  return (
    <>
      {executions.map((execution) => (
        <ExecutionRow key={execution.id} execution={execution} />
      ))}
    </>
  )
}

export default function Executions(): ReactElement {
  const { input, page, status, setSearchParams, isSearching } =
    usePaginationAndFilter()

  const filterRef = useRef<HTMLDivElement>(null)
  const [inputPadding, setInputPadding] = useState<number>(0)

  // update padding of input element when filter element width changes.
  useEffect(() => {
    if (!filterRef.current) {
      return
    }
    setInputPadding(filterRef.current.offsetWidth + 8)
  }, [status])

  const { data, loading } = useQuery(GET_EXECUTIONS, {
    variables: getLimitAndOffset({
      page,
      status,
      input,
    }),
    fetchPolicy: 'cache-and-network',
    pollInterval: 5000,
  })

  const getExecutions = data?.getExecutions || {}
  const { pageInfo, edges } = getExecutions

  const executions: IExecution[] =
    edges?.map(({ node }: { node: IExecution }) => node) ?? []

  const handleSearchInputChangeDebounced = useMemo(
    () => debounce((newInput) => setSearchParams({ input: newInput }), 500),
    [setSearchParams],
  )

  const onSearchInputChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      handleSearchInputChangeDebounced(event.target.value)
    },
    [handleSearchInputChangeDebounced],
  )

  const hasNoUserExecutions = executions.length === 0 && !isSearching
  const hasPagination = !loading && pageInfo?.totalCount > EXECUTION_PER_PAGE

  return (
    <Container py={9}>
      <PageTitle
        title={EXECUTIONS_TITLE}
        searchComponent={
          !hasNoUserExecutions && (
            <InputGroup maxW="25rem">
              <InputLeftElement>
                <Icon as={BiSearch} boxSize={5} />
              </InputLeftElement>
              <Input
                textStyle="body-1"
                w="21rem"
                pr={inputPadding}
                placeholder="Search by pipe name"
                defaultValue={input}
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
                  filterStatus={status}
                  onFilterChange={(status) => setSearchParams({ status })}
                ></ExecutionStatusMenu>
              </InputRightElement>
            </InputGroup>
          )
        }
      />

      <ExecutionsList
        executions={executions}
        isLoading={loading}
        isSearching={isSearching}
      />

      {hasPagination && (
        <Flex justifyContent="center" mt={6}>
          <Pagination
            currentPage={pageInfo?.currentPage}
            onPageChange={(page) => setSearchParams({ page })}
            pageSize={EXECUTION_PER_PAGE}
            totalCount={pageInfo?.totalCount}
          />
        </Flex>
      )}
    </Container>
  )
}
