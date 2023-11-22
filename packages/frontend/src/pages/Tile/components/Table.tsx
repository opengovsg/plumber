import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Box, Flex, useOutsideClick } from '@chakra-ui/react'
import {
  ColumnOrderState,
  createRow as createEmptyRow,
  getCoreRowModel,
  getSortedRowModel,
  Row,
  useReactTable,
} from '@tanstack/react-table'
import { useVirtualizer } from '@tanstack/react-virtual'

import { NEW_ROW_ID, ROW_HEIGHT, TEMP_ROW_ID_PREFIX } from '../constants'
import { useTableContext } from '../contexts/TableContext'
import { createColumns } from '../helpers/columns-helper'
import { scrollToBottom } from '../helpers/scroll-helper'
import { shallowCompare } from '../helpers/shallow-compare'
import { useCreateRow } from '../hooks/useCreateRow'
import { useUpdateRow } from '../hooks/useUpdateRow'
import { CellType, GenericRowData } from '../types'

import TableFooter from './TableFooter'
import TableHeader from './TableHeader'
import TableRow from './TableRow'

export default function Table(): JSX.Element {
  const { tableColumns, flattenedData } = useTableContext()
  const [data, setData] = useState<GenericRowData[]>(flattenedData)
  // const [data, setData] = useState<GenericRowData[]>([...flattenedData, newRow])
  const parentRef = useRef<HTMLDivElement>(null)
  const columns = useMemo(() => createColumns(tableColumns), [tableColumns])
  const [rowSelection, setRowSelection] = useState({})
  const [columnOrder, setColumnOrder] = useState<ColumnOrderState>(
    columns.map((c) => c.id as string),
  )
  useEffect(() => {
    setColumnOrder(columns.map((c) => c.id as string))
  }, [columns])

  const [editingCell, setEditingCell] = useState<CellType | null>(null)
  // We use ref instead of state to prevent re-rendering on change
  // it's only used as a cache
  const tempRowData = useRef<GenericRowData | null>(null)

  const rowVirtualizer = useVirtualizer({
    count: data.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT.DEFAULT,
    paddingEnd: ROW_HEIGHT.EXPANDED - ROW_HEIGHT.DEFAULT + 1,
    overscan: 35,
  })

  const { rowsUpdating, updateRow } = useUpdateRow(setData)
  const { rowsCreated, createRow } = useCreateRow(setData)

  const setActiveCell = useCallback(
    (newCell: CellType | null) => {
      setEditingCell((currentCell) => {
        // If no previous cell is active or same row, do nothing
        if (currentCell?.row.id === newCell?.row.id) {
          return newCell
        }
        rowVirtualizer.measure()
        const rowDataToSave = tempRowData.current
        // If new cell is selected, store original row data in cache
        if (newCell) {
          tempRowData.current = { ...newCell?.row.original }
        }
        // if cache data has changed, save new data
        if (
          currentCell &&
          rowDataToSave &&
          !shallowCompare(currentCell.row.original, rowDataToSave)
        ) {
          if (rowDataToSave.rowId !== NEW_ROW_ID) {
            // update row
            updateRow(rowDataToSave)
          } else {
            // add new row
            createRow(rowDataToSave)
            scrollToBottom(parentRef)
          }
        }
        return newCell
      })
    },
    [createRow, rowVirtualizer, updateRow],
  )

  const removeRows = useCallback(
    (rowIds: string[]) => {
      const deletedRowIds = new Set(rowIds)
      setData((data) => data.filter((row) => !deletedRowIds.has(row.rowId)))
    },
    [setData],
  )

  const table = useReactTable({
    data,
    columns,
    getRowId: (row) => row.rowId,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    onColumnOrderChange: setColumnOrder,
    columnResizeMode: 'onChange',
    // debugAll: appConfig.isDev,
    enableRowSelection: (row) =>
      // prevent selection of new and temp rows
      row.id !== NEW_ROW_ID && !row.id.startsWith(TEMP_ROW_ID_PREFIX),
    onRowSelectionChange: setRowSelection,
    state: {
      columnOrder,
      rowSelection,
      rowPinning: {
        bottom: [NEW_ROW_ID],
      },
    },
    meta: {
      rowsUpdating,
      rowsCreated,
      tempRowData,
      activeCell: editingCell,
      setActiveCell,
      removeRows,
    },
  })

  const newRow = createEmptyRow(
    table,
    NEW_ROW_ID,
    { rowId: NEW_ROW_ID },
    data.length,
    0,
  )

  // Handle click outside of table
  useOutsideClick({
    ref: parentRef,
    handler: () => {
      setActiveCell(null)
    },
  })

  const { rows } = table.getSortedRowModel()
  const virtualRows = rowVirtualizer.getVirtualItems()

  return (
    <Flex
      borderRadius="lg"
      overflow="auto"
      w="100%"
      borderColor="primary.800"
      borderWidth={1}
      ref={parentRef}
      h="calc(100vh - 210px)"
      minH="300px"
      flexDir="column"
      position="relative"
      // prevent active element from being hidden by footer
      scrollPaddingBottom={
        editingCell?.row.id === NEW_ROW_ID ? 0 : ROW_HEIGHT.FOOTER
      }
    >
      <Flex flexDir="column" w="fit-content" minW="100%" flex={1}>
        <Flex
          bgColor="primary.700"
          alignItems="stretch"
          position="sticky"
          top={0}
          zIndex={10}
          color="white"
          fontWeight="bold"
        >
          <TableHeader table={table} />
        </Flex>

        <Box position="relative" borderY="none">
          {rows.length ? (
            <Box h={rowVirtualizer.getTotalSize()}>
              {virtualRows.map((virtualRow) => {
                const row = rows[virtualRow.index] as Row<GenericRowData>
                return (
                  <TableRow
                    key={row.id}
                    row={row}
                    isEditing={editingCell?.row.id === row.id}
                    virtualRow={virtualRow}
                  />
                )
              })}
            </Box>
          ) : (
            <>{/* insert some call to action to add new row here */}</>
          )}
        </Box>
      </Flex>
      <TableRow
        row={newRow}
        isEditing={editingCell?.row.id === NEW_ROW_ID}
        stickyBottom
      />
      <TableFooter table={table} parentRef={parentRef} />
    </Flex>
  )
}
