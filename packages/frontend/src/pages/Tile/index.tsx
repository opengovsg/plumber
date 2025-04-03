import { ITableMetadata } from '@plumber/types'

import { useParams } from 'react-router-dom'
import { ApolloError, useQuery } from '@apollo/client'
import { Center, Flex } from '@chakra-ui/react'

import PrimarySpinner from '@/components/PrimarySpinner'
import { NOT_FOUND } from '@/config/errors'
import { GET_TABLE } from '@/graphql/queries/tiles/get-table'
import { parseGraphqlError } from '@/helpers/parseGraphqlError'

import { MissingTile } from '../UnauthorizedTile'

import Table from './components/Table'
import TableBanner from './components/TableBanner'
import { TableContextProvider } from './contexts/TableContext'
import { useFetchAllRows } from './hooks/useFetchAllRows'

export default function Tile(): JSX.Element | null {
  const { tileId: tableId, viewOnlyKey: urlViewOnlyKey } = useParams<{
    tileId: string
    viewOnlyKey?: string
  }>()

  const { rows, isFetching, isThroughputError, refetch } = useFetchAllRows({
    tableId: tableId as string,
    urlViewOnlyKey,
  })

  const {
    data: getTableData,
    loading: isTableLoading,
    error: getTableError,
    called: isGetTableCalled,
  } = useQuery<{
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
    onCompleted: () => {
      // only start fetching rows after table metadata is loaded
      refetch()
    },
  })
  const ownRole = getTableData?.getTable?.role

  // On first load, show loading spinner
  if (isTableLoading && !isGetTableCalled) {
    return (
      <Center height="100vh">
        <PrimarySpinner fontSize="6xl" thickness="4px" margin="auto" />
      </Center>
    )
  }

  if (getTableError) {
    if (getTableError instanceof ApolloError) {
      const { code } = parseGraphqlError(getTableError)
      if (code === NOT_FOUND) {
        return (
          <MissingTile title="You do not have access to this Tile, or it does not exist." />
        )
      }
    }
    return (
      <MissingTile title="Error loading your tile. Please refresh and try again." />
    )
  }

  if (!getTableData?.getTable) {
    return null
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
