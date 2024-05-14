import { ITableMetadata, ITableRow } from '@plumber/types'

import { useParams } from 'react-router-dom'
import { useQuery } from '@apollo/client'
import { Center, Flex, Spinner } from '@chakra-ui/react'
import { GET_ALL_ROWS } from 'graphql/queries/tiles/get-all-rows'
import { GET_TABLE } from 'graphql/queries/tiles/get-table'

import Table from './components/Table'
import TableBanner from './components/TableBanner'
import { TableContextProvider } from './contexts/TableContext'

export default function Tile(): JSX.Element {
  const { tileId: tableId, viewOnlyKey: urlViewOnlyKey } = useParams<{
    tileId: string
    viewOnlyKey?: string
  }>()

  const isReadOnly = !!urlViewOnlyKey

  const { data: getTableData } = useQuery<{
    getTable: ITableMetadata
  }>(GET_TABLE, {
    variables: {
      tableId,
    },
    context: isReadOnly
      ? {
          headers: { 'x-tiles-view-key': urlViewOnlyKey },
        }
      : undefined,
  })

  const { data: getAllRowsData } = useQuery<{
    getAllRows: ITableRow[]
  }>(GET_ALL_ROWS, {
    variables: {
      tableId,
      viewOnlyKey: urlViewOnlyKey,
    },
    context: isReadOnly
      ? {
          headers: { 'x-tiles-view-key': urlViewOnlyKey },
        }
      : undefined,
    fetchPolicy: 'network-only',
  })

  if (!getTableData?.getTable || !getAllRowsData?.getAllRows) {
    return (
      <Center height="100vh">
        <Spinner size="xl" thickness="4px" color="primary.500" margin="auto" />
      </Center>
    )
  }

  const { id, name, columns, viewOnlyKey } = getTableData.getTable
  const rows = getAllRowsData.getAllRows

  return (
    <TableContextProvider
      tableName={name}
      tableId={id}
      tableColumns={columns}
      tableRows={rows}
      hasEditPermission={!isReadOnly}
      viewOnlyKey={viewOnlyKey}
    >
      <Flex
        flexDir={{ base: 'column' }}
        justifyContent="space-between"
        alignItems="stretch"
      >
        <TableBanner />
        <Table />
      </Flex>
    </TableContextProvider>
  )
}
