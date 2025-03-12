import { ITableMetadata } from '@plumber/types'

import { useParams } from 'react-router-dom'
import { useQuery } from '@apollo/client'
import { Center, Flex } from '@chakra-ui/react'

import PrimarySpinner from '@/components/PrimarySpinner'
import { GET_TABLE } from '@/graphql/queries/tiles/get-table'

import Table from './components/Table'
import TableBanner from './components/TableBanner'
import { TableContextProvider } from './contexts/TableContext'
import { useFetchAllRows } from './hooks/useFetchAllRows'

export default function Tile(): JSX.Element {
  const { tileId: tableId, viewOnlyKey: urlViewOnlyKey } = useParams<{
    tileId: string
    viewOnlyKey?: string
  }>()

  const { data: getTableData } = useQuery<{
    getTable: ITableMetadata
  }>(GET_TABLE, {
    variables: {
      tableId,
    },
    context: urlViewOnlyKey
      ? {
          headers: { 'x-tiles-view-key': urlViewOnlyKey },
        }
      : undefined,
  })
  const ownRole = getTableData?.getTable?.role

  const { rows, isFetching, isThroughputError, refetch } = useFetchAllRows({
    tableId: tableId as string,
    urlViewOnlyKey,
  })

  if (!getTableData?.getTable) {
    return (
      <Center height="100vh">
        <PrimarySpinner fontSize="6xl" thickness="4px" margin="auto" />
      </Center>
    )
  }

  const { id, name, columns, viewOnlyKey, collaborators } =
    getTableData.getTable

  return (
    <TableContextProvider
      tableName={name}
      tableId={id}
      tableColumns={columns}
      tableRows={rows}
      viewOnlyKey={viewOnlyKey}
      collaborators={collaborators}
      role={ownRole}
      isFetching={isFetching}
      isThroughputError={isThroughputError}
      refetch={refetch}
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
