import { ITableMetadata, ITableRow } from '@plumber/types'

import { useParams } from 'react-router-dom'
import { useQuery } from '@apollo/client'
import { Center, Flex, Spinner, Text } from '@chakra-ui/react'
import { GET_ALL_ROWS } from 'graphql/queries/get-all-rows'
import { GET_TABLE } from 'graphql/queries/get-table'

import Table from './components/Table'
import { TableContextProvider } from './contexts/TableContext'

export default function Tile(): JSX.Element {
  const { tableId } = useParams<{ tableId: string }>()

  const { data: getTableData } = useQuery<{
    getTable: ITableMetadata
  }>(GET_TABLE, {
    variables: {
      tableId,
    },
  })

  const { data: getAllRowsData } = useQuery<{
    getAllRows: ITableRow[]
  }>(GET_ALL_ROWS, {
    variables: {
      tableId,
    },
    fetchPolicy: 'network-only',
  })

  if (!getTableData?.getTable || !getAllRowsData?.getAllRows) {
    return (
      <Center height="100vh">
        <Spinner size="xl" thickness="4px" color="primary.500" margin="auto" />
      </Center>
    )
  }

  const { id, name, columns } = getTableData.getTable
  const rows = getAllRowsData.getAllRows

  return (
    <Flex
      flexDir={{ base: 'column' }}
      justifyContent="space-between"
      alignItems="stretch"
      gap={4}
      p={8}
    >
      <Text textStyle="h4">{name}</Text>
      <TableContextProvider
        tableId={id}
        tableColumns={columns}
        tableRows={rows}
      >
        <Table />
      </TableContextProvider>
    </Flex>
  )
}
