import { ITableMetadata, ITableRow } from '@plumber/types'

import { useParams } from 'react-router-dom'
import { useQuery } from '@apollo/client'
import { Center, Flex, Spinner, Text } from '@chakra-ui/react'
import Container from 'components/Container'
import { GET_ALL_ROWS } from 'graphql/queries/get-all-rows'
import { GET_TABLE } from 'graphql/queries/get-table'

import Table from './components/Table'

export default function Tile(): JSX.Element {
  const { tableId } = useParams<{ tableId: string }>()

  const { data: getTableData, loading: getTableLoading } = useQuery<{
    getTable: ITableMetadata
  }>(GET_TABLE, {
    variables: {
      tableId,
    },
  })

  const { data: getAllRowsData, loading: getAllRowsLoading } = useQuery<{
    getAllRows: ITableRow[]
  }>(GET_ALL_ROWS, {
    variables: {
      tableId,
    },
  })

  if (
    !getTableData?.getTable ||
    !getAllRowsData?.getAllRows ||
    getTableLoading ||
    getAllRowsLoading
  ) {
    return (
      <Center height="100vh">
        <Spinner size="xl" thickness="4px" color="primary.500" margin="auto" />
      </Center>
    )
  }

  const {
    getTable: { id, name, columns },
  } = getTableData
  const { getAllRows: rows } = getAllRowsData

  return (
    <Container py={7}>
      <Flex
        flexDir={{ base: 'column' }}
        justifyContent="space-between"
        alignItems="stretch"
        gap={4}
      >
        <Text textStyle="h4">{name}</Text>
        <Table tableId={id} tableColumns={columns} tableRows={rows} />
      </Flex>
    </Container>
  )
}
