import { ITableMetadata, ITableRow } from '@plumber/types'

import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery } from '@apollo/client'
import { Center, Flex } from '@chakra-ui/react'

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

  const { data: initialData, fetchMore,  } = useQuery(GET_ALL_ROWS, {
    variables: {
      tableId: tableId as string,
    },
    context: urlViewOnlyKey
      ? {
          headers: { 'x-tiles-view-key': urlViewOnlyKey },
        }
      : undefined,
    fetchPolicy: 'no-cache',
    onCompleted: async (data) => {
      if (!data.getAllRows) {
        return
      }
      setRows((prevRows) => [...prevRows, ...data.getAllRows.rows])
    },
  })

  // Function to load more items until all data is fetched
  const loadMoreRows = useCallback(
    async (cursor: string | null) => {
      let currentCursor: string | null = cursor

      while (currentCursor) {
        const { data } = await fetchMore({
          variables: { stringifiedCursor: currentCursor },
        })

        if (data) {
          setRows((prevRows) => [...prevRows, ...data.getAllRows.rows])
          currentCursor = data.getAllRows.stringifiedCursor ?? null
        } else {
          currentCursor = null
        }
      }
      setIsFetching(false)
    },
    [fetchMore],
  )

  // Load all data when the component mounts
  useEffect(() => {
    const initialRows = initialData?.getAllRows
    if (!initialRows) {
      return
    }
    setRows(initialRows.rows)
    if (initialRows.stringifiedCursor) {
      loadMoreRows(initialRows.stringifiedCursor)
    }
  }, [initialData, loadMoreRows])

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
