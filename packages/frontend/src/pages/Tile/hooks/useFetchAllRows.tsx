import { ITableRow, ITableRowCsv } from '@plumber/types'

import { useCallback, useRef, useState } from 'react'
import { ApolloError, useLazyQuery } from '@apollo/client'
import { datadogRum } from '@datadog/browser-rum'
import { zipObject } from 'lodash'

import { RATE_LIMITED } from '@/config/errors'
import { GET_ALL_ROWS } from '@/graphql/queries/tiles/get-all-rows'
import { parseGraphqlError } from '@/helpers/parseGraphqlError'

/**
 * Converts a CSV row to an object using column IDs as keys
 * @param row The row to convert
 * @param columnIds Array of column IDs to use as keys
 * @returns The converted row
 */
const convertCsvRowToObject = (
  row: ITableRowCsv,
  columnIds: string[],
): ITableRow => {
  const dataArray = JSON.parse(row.data)

  if (dataArray.length !== columnIds.length) {
    console.warn(
      `Row data length (${dataArray.length}) doesn't match columnIds length (${columnIds.length})`,
    )
    // Create a new ITableRow with empty data object
    return {
      rowId: row.rowId,
      data: {},
    }
  }

  return {
    rowId: row.rowId,
    data: zipObject(columnIds, dataArray),
  }
}

/**
 * Processes a row, converting it from CSV format if necessary
 * @param row The row to process
 * @param columnIds Array of column IDs to use as keys
 * @returns The processed row
 */
const processRow = (
  row: ITableRowCsv | ITableRow,
  columnIds: string[],
): ITableRow => {
  if (typeof row.data === 'string') {
    return convertCsvRowToObject(row as ITableRowCsv, columnIds)
  }
  return row as ITableRow
}

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

  const [fetchAllRowsQuery] = useLazyQuery(GET_ALL_ROWS, {
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
          const { data, error } = await fetchAllRowsQuery({
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
          const { rows, columnIds } = data.getAllRows

          // Process all rows, converting CSV format to objects if needed
          const processedRows = rows.map((row: ITableRowCsv | ITableRow) =>
            processRow(row, columnIds),
          )
          rowCount += processedRows.length
          setRows((prev) => [...prev, ...processedRows])
          currentCursor = data?.getAllRows.stringifiedCursor ?? undefined
        } while (currentCursor)
      } catch (e) {
        if (
          e instanceof ApolloError &&
          parseGraphqlError(e).code === RATE_LIMITED
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
    [fetchAllRowsQuery, tableId],
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

  return {
    rows,
    cursorToContinueFrom,
    isFetching,
    isThroughputError,
    refetch,
  }
}
