import { ITableMetadata } from '@plumber/types'

import { useEffect } from 'react'
import { Helmet } from 'react-helmet'
import { useParams } from 'react-router-dom'
import { ApolloError, useQuery } from '@apollo/client'
import { Center, Flex } from '@chakra-ui/react'

import PrimarySpinner from '@/components/PrimarySpinner'
import {
  INVALID_TILE_VIEW_KEY,
  INVALID_TILE_VIEW_TOKEN,
  NOT_FOUND,
} from '@/config/errors'
import * as URLS from '@/config/urls'
import { GET_TABLE } from '@/graphql/queries/tiles/get-table'
import { parseGraphqlError } from '@/helpers/parseGraphqlError'

import { MissingTile } from '../UnauthorizedTile'

import Table from './components/Table'
import TableBanner from './components/TableBanner'
import TilePasswordPrompt from './components/TilePasswordPrompt'
import { TableContextProvider } from './contexts/TableContext'
import { useFetchAllRows } from './hooks/useFetchAllRows'
import { useViewToken } from './hooks/useViewToken'

export default function Tile(): JSX.Element | null {
  const { tileId: tableId, viewOnlyKey: urlViewOnlyKey } = useParams<{
    tileId: string
    viewOnlyKey?: string
  }>()

  const { viewToken, storeViewToken } = useViewToken(tableId as string)

  const viewOnlyHeaders = urlViewOnlyKey
    ? {
        'x-tiles-view-key': urlViewOnlyKey,
        ...(viewToken && { 'x-tiles-view-token': viewToken }),
      }
    : undefined

  const { rows, isFetching, isThroughputError, refetch } = useFetchAllRows({
    tableId: tableId as string,
    urlViewOnlyKey,
    viewToken,
  })

  const {
    data: getTableData,
    loading: isTableLoading,
    error: getTableError,
    called: isGetTableCalled,
    refetch: refetchTable,
  } = useQuery<{
    getTable: ITableMetadata
  }>(GET_TABLE, {
    variables: {
      tableId,
    },
    context: viewOnlyHeaders
      ? {
          headers: viewOnlyHeaders,
        }
      : undefined,
  })
  const ownRole = getTableData?.getTable?.role

  useEffect(() => {
    if (isGetTableCalled && getTableData?.getTable) {
      // load rows after fetching table metadata
      refetch()
    }
  }, [isGetTableCalled, getTableError, getTableData, refetch])

  // Refetch table data when view token changes (e.g. after password verification)
  useEffect(() => {
    if (viewToken && getTableError) {
      refetchTable()
    }
  }, [viewToken, getTableError, refetchTable])

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
      // Check for password-protected tile error<
      const { code, data } = parseGraphqlError(getTableError)
      if (
        code === INVALID_TILE_VIEW_TOKEN &&
        urlViewOnlyKey &&
        data?.tableName
      ) {
        return (
          <TilePasswordPrompt
            tableId={tableId as string}
            tableName={data?.tableName as string}
            viewOnlyKey={urlViewOnlyKey}
            onSuccess={storeViewToken}
          />
        )
      }

      if (code === NOT_FOUND) {
        return (
          <MissingTile title="You do not have access to this Tile, or it does not exist." />
        )
      }
      if (code === INVALID_TILE_VIEW_KEY) {
        window.location.href = URLS.UNAUTHORIZED_TILE
        return null
      }
    }
    return (
      <MissingTile title="Error loading your tile. Please refresh and try again." />
    )
  }

  if (!getTableData?.getTable) {
    return null
  }

  const { id, name, columns, viewOnlyKey, collaborators, databaseType } =
    getTableData.getTable

  return (
    <TableContextProvider
      tableName={name}
      tableId={id}
      databaseType={databaseType}
      tableColumns={columns}
      tableRows={rows}
      viewOnlyKey={viewOnlyKey}
      collaborators={collaborators}
      role={ownRole}
      isFetching={isFetching}
      isThroughputError={isThroughputError}
      refetch={refetch}
    >
      <Helmet>
        <meta name="robots" content="noindex,nofollow" />
        <title>{name} | Tile</title>
      </Helmet>
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
