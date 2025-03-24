import { ITableRow } from '@plumber/types'

import { useCallback, useEffect, useRef, useState } from 'react'
import { ApolloError, ServerError, useLazyQuery } from '@apollo/client'
import { datadogRum } from '@datadog/browser-rum'

import { GET_ALL_ROWS } from '@/graphql/queries/tiles/get-all-rows'

export function useFetchAllRows({
  tableId,
  urlViewOnlyKey,
}: {
  tableId: string
  urlViewOnlyKey?: string
}) {
  const [rows, setRows] = useState<ITableRow[]>([])
  const [isThroughputError, setIsThroughputError] = useState(false)
  const [isFetching, setIsFetching] = useState(false)

  const cursorToContinueFrom = useRef<string>()
  const startTime = useRef<number>()

  const [fetchAllRowsMutation] = useLazyQuery(GET_ALL_ROWS, {
    context: urlViewOnlyKey
      ? {
          headers: { 'x-tiles-view-key': urlViewOnlyKey },
        }
      : undefined,
    fetchPolicy: 'cache-and-network',
  })

  const fetchAllRows = useCallback(
    async (cursor?: string) => {
      startTime.current = performance.now()
      setIsFetching(true)
      let rowCount = 0
      let currentCursor = cursor
      try {
        do {
          const { data, error } = await fetchAllRowsMutation({
            variables: {
              stringifiedCursor: currentCursor,
              tableId: tableId,
            },
          })
          if (error) {
            throw error
          }
          if (!data?.getAllRows) {
            throw new Error('No data returned from getAllRows')
          }
          rowCount += data.getAllRows.rows.length
          setRows((prev) => [...prev, ...data.getAllRows.rows])
          currentCursor = data?.getAllRows.stringifiedCursor ?? undefined
        } while (currentCursor)
      } catch (e) {
        if (
          e instanceof ApolloError &&
          e.networkError &&
          (e.networkError as ServerError).statusCode === 429
        ) {
          setIsThroughputError(true)
          cursorToContinueFrom.current = currentCursor
        } else {
          setIsThroughputError(false)
        }
      } finally {
        datadogRum.setGlobalContextProperty(
          'tile_load_time',
          performance.now() - startTime.current,
        )
        datadogRum.setGlobalContextProperty('tile_row_count', rowCount)
        setIsFetching(false)
      }
    },
    [fetchAllRowsMutation, tableId],
  )

  const refetch = useCallback(async () => {
    if (isThroughputError) {
      // we do not clear the rows here because we want to preserve the rows that have already been fetched
      setIsThroughputError(false)
    } else {
      // if there is no throughput error, we clear the rows and start from the beginning
      setRows([])
      cursorToContinueFrom.current = undefined
    }
    await fetchAllRows(cursorToContinueFrom.current)
  }, [fetchAllRows, isThroughputError])

  useEffect(() => {
    setRows([])
    fetchAllRows()
  }, [fetchAllRows])

  return {
    rows,
    cursorToContinueFrom,
    isFetching,
    isThroughputError,
    refetch,
  }
}
