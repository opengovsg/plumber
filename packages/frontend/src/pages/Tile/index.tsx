import { ITableMetadata, ITableRow } from '@plumber/types'

import { useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery } from '@apollo/client'
import { Center, Flex } from '@chakra-ui/react'
import { datadogRum } from '@datadog/browser-rum'

import PrimarySpinner from '@/components/PrimarySpinner'
import { GET_ALL_ROWS } from '@/graphql/queries/tiles/get-all-rows'
import { GET_TABLE } from '@/graphql/queries/tiles/get-table'

import Table from './components/Table'
import TableBanner from './components/TableBanner'
import { TableContextProvider } from './contexts/TableContext'

export default function Tile(): JSX.Element {
  const { tileId: tableId, viewOnlyKey: urlViewOnlyKey } = useParams<{
    tileId: string
    viewOnlyKey?: string
  }>()
  const [rows, setRows] = useState<ITableRow[]>([])
  const [isFetching, setIsFetching] = useState(true)
  const startTime = useRef(performance.now())

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

  const { data: initialData, fetchMore } = useQuery(GET_ALL_ROWS, {
    variables: {
      tableId: tableId as string,
    },
    context: urlViewOnlyKey
      ? {
          headers: { 'x-tiles-view-key': urlViewOnlyKey },
        }
      : undefined,
    // this fetchPolicy needs to be set for onCompleted to be called on refetch
    // i.e. after csv upload
    fetchPolicy: 'cache-and-network',
    onCompleted: async (data) => {
      if (!data.getAllRows) {
        return
      }
      let currentCursor = data.getAllRows.stringifiedCursor
      let allRows = data.getAllRows.rows
      setRows(allRows)
      while (currentCursor) {
        const { data: newData } = await fetchMore({
          variables: {
            stringifiedCursor: currentCursor,
          },
        })
        allRows = [...allRows, ...newData.getAllRows.rows]
        currentCursor = newData.getAllRows.stringifiedCursor
        setRows(allRows)
      }
      datadogRum.setGlobalContextProperty(
        'tile_load_time',
        performance.now() - startTime.current,
      )
      datadogRum.setGlobalContextProperty('tile_row_count', allRows.length)
      setIsFetching(false)
    },
  })

  if (!getTableData?.getTable || !initialData?.getAllRows) {
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
